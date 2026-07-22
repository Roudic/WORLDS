#include "CombatSystem.h"
#include "PowerSystem.h"
#include "DiceSystem.h"

namespace RiftCombat
{
	static int32 ComputeVitality(int32 Grit, int32 Level)
	{
		return 30 + Grit * 4 + Level * 6;
	}

	static int32 ComputeFlux(int32 Control, int32 Will)
	{
		return 12 + Control * 2 + Will;
	}

	static int32 ComputeStagger(int32 Grit, int32 Level)
	{
		return 12 + Grit + Level * 2;
	}

	static void PushLog(FRiftCombatState& State, const FString& Text, const FString& Kind = TEXT("info"))
	{
		FRiftCombatLogEntry E;
		E.Text = Text;
		E.Kind = Kind;
		State.Log.Add(E);
		if (State.Log.Num() > 40)
		{
			State.Log.RemoveAt(0, State.Log.Num() - 40);
		}
	}

	static void RefreshPL(FRiftCombatant& C)
	{
		C.CachedPL = RiftPower::CombatantPower(C).PowerLevel;
	}

	static FRiftCombatant* Active(FRiftCombatState& State)
	{
		if (!State.Combatants.IsValidIndex(State.ActiveIndex)) return nullptr;
		return &State.Combatants[State.ActiveIndex];
	}

	static FRiftCombatant* Opponent(FRiftCombatState& State, const FRiftCombatant& Self)
	{
		for (FRiftCombatant& C : State.Combatants)
		{
			if (C.Id != Self.Id && C.bAlive) return &C;
		}
		return nullptr;
	}

	static void CheckEnd(FRiftCombatState& State)
	{
		bool bPlayerAlive = false;
		bool bFoeAlive = false;
		for (const FRiftCombatant& C : State.Combatants)
		{
			if (!C.bAlive) continue;
			if (C.bIsPlayer) bPlayerAlive = true;
			else bFoeAlive = true;
		}
		if (!bPlayerAlive || !bFoeAlive)
		{
			State.bFinished = true;
			State.bVictory = bPlayerAlive && !bFoeAlive;
			PushLog(State, State.bVictory ? TEXT("Victory — the field goes quiet.") : TEXT("Defeat — the scanners drop to zero."),
				State.bVictory ? TEXT("defeat") : TEXT("defeat"));
		}
	}

	static void DealDamage(FRiftCombatState& State, FRiftCombatant& Attacker, FRiftCombatant& Defender, int32 Base, FRandomStream& Rng)
	{
		RefreshPL(Attacker);
		RefreshPL(Defender);
		const float Mult = RiftPower::PowerDamageMult(Attacker.CachedPL, Defender.CachedPL);
		const int32 Variance = Rng.RandRange(85, 115);
		int32 Damage = FMath::Max(1, FMath::RoundToInt(Base * Mult * Variance / 100.f));
		if (Defender.Stagger >= Defender.MaxStagger)
		{
			Damage = FMath::RoundToInt(Damage * 1.35f);
			Defender.Stagger = 0;
			PushLog(State, FString::Printf(TEXT("%s is staggered open!"), *Defender.Name), TEXT("attack"));
		}
		Defender.Vitality = FMath::Max(0, Defender.Vitality - Damage);
		Defender.Stagger = FMath::Min(Defender.MaxStagger, Defender.Stagger + FMath::Max(2, Damage / 4));
		Defender.Pressure = FMath::Min(12, Defender.Pressure + 1);
		PushLog(State, FString::Printf(TEXT("%s hits %s for %d (PL %s vs %s)."),
			*Attacker.Name, *Defender.Name, Damage,
			*RiftPower::FormatPL(Attacker.CachedPL), *RiftPower::FormatPL(Defender.CachedPL)), TEXT("attack"));
		if (Defender.Vitality <= 0)
		{
			Defender.bAlive = false;
			PushLog(State, FString::Printf(TEXT("%s falls."), *Defender.Name), TEXT("defeat"));
		}
	}

	FRiftCombatant PlayerToCombatant(const FRiftPlayerBuild& Player)
	{
		FRiftCombatant C;
		C.Id = TEXT("player");
		C.Name = Player.Name;
		C.bIsPlayer = true;
		C.Attributes = Player.Attributes;
		C.Level = Player.Level;
		C.MaxVitality = ComputeVitality(Player.Attributes.Grit, Player.Level);
		C.Vitality = C.MaxVitality;
		C.MaxFlux = ComputeFlux(Player.Attributes.Control, Player.Attributes.Will);
		C.Flux = C.MaxFlux;
		C.MaxStagger = ComputeStagger(Player.Attributes.Grit, Player.Level);
		C.Output = 0.6f;
		C.FormId = Player.FormId;
		C.bAscended = Player.bAscensionUnlocked && Player.FormId != ERiftFormId::Base;
		RefreshPL(C);
		return C;
	}

	FRiftCombatant MakeFoe(const FString& EncounterId, const FRiftPlayerBuild& Player, FRandomStream& Rng)
	{
		const FRiftPowerReading PPL = RiftPower::PlayerPower(Player);
		float Scale = 0.9f;
		FString Name = TEXT("Rift Raider");
		if (EncounterId == TEXT("world_hunt"))
		{
			Scale = 1.35f;
			Name = TEXT("Ceiling Hunter");
		}
		else if (EncounterId == TEXT("world_skirmish"))
		{
			Scale = 0.85f;
			Name = TEXT("District Blade");
		}
		else if (EncounterId == TEXT("world_ambush"))
		{
			Scale = 1.05f;
			Name = TEXT("Road Ambush");
		}
		else if (EncounterId == TEXT("roster_spar"))
		{
			Scale = 1.0f;
			Name = TEXT("Roster Spar");
		}
		else
		{
			Name = TEXT("World Duelist");
			Scale = 1.1f;
		}

		FRiftCombatant F;
		F.Id = TEXT("foe");
		F.Name = Name;
		F.bIsPlayer = false;
		F.Level = FMath::Max(1, Player.Level + Rng.RandRange(-1, 2));
		F.Attributes.Might = FMath::RoundToInt(Player.Attributes.Might * Scale);
		F.Attributes.Grit = FMath::RoundToInt(Player.Attributes.Grit * Scale);
		F.Attributes.Agility = FMath::RoundToInt(Player.Attributes.Agility * (Scale * 0.95f));
		F.Attributes.Will = FMath::RoundToInt(Player.Attributes.Will * Scale);
		F.Attributes.Presence = FMath::RoundToInt(Player.Attributes.Presence * Scale);
		F.Attributes.Intellect = FMath::RoundToInt(Player.Attributes.Intellect * 0.9f);
		F.Attributes.Control = FMath::RoundToInt(Player.Attributes.Control * Scale);
		F.MaxVitality = ComputeVitality(F.Attributes.Grit, F.Level);
		F.Vitality = F.MaxVitality;
		F.MaxFlux = ComputeFlux(F.Attributes.Control, F.Attributes.Will);
		F.Flux = F.MaxFlux;
		F.MaxStagger = ComputeStagger(F.Attributes.Grit, F.Level);
		F.Output = 0.55f + Rng.FRand() * 0.25f;
		if (PPL.PowerLevel > 5000 && Rng.FRand() < 0.35f)
		{
			F.bAscended = true;
			F.FormId = ERiftFormId::TemperedWake;
		}
		RefreshPL(F);
		return F;
	}

	FRiftCombatState StartEncounter(const FString& EncounterId, const FRiftPlayerBuild& Player, FRandomStream& Rng)
	{
		FRiftCombatState S;
		S.Id = EncounterId;
		S.Name = EncounterId.Replace(TEXT("_"), TEXT(" "));
		S.Name = S.Name.ToUpper();
		S.Description = TEXT("Scanner locks. The arena answers.");
		S.Combatants.Add(PlayerToCombatant(Player));
		S.Combatants.Add(MakeFoe(EncounterId, Player, Rng));
		S.ActiveIndex = 0;
		S.Round = 1;
		PushLog(S, FString::Printf(TEXT("Encounter: %s — PL %s vs %s"),
			*S.Name,
			*RiftPower::FormatPL(S.Combatants[0].CachedPL),
			*RiftPower::FormatPL(S.Combatants[1].CachedPL)), TEXT("system"));
		return S;
	}

	TArray<FString> AvailableActions(const FRiftCombatState& State)
	{
		if (State.bFinished) return {};
		return { TEXT("strike"), TEXT("rush"), TEXT("bolt"), TEXT("powerup"), TEXT("guard"), TEXT("ascend") };
	}

	static void NextTurn(FRiftCombatState& State)
	{
		const int32 Start = State.ActiveIndex;
		for (int32 i = 0; i < State.Combatants.Num(); ++i)
		{
			State.ActiveIndex = (Start + 1 + i) % State.Combatants.Num();
			if (State.Combatants[State.ActiveIndex].bAlive)
			{
				if (State.ActiveIndex == 0)
				{
					++State.Round;
				}
				return;
			}
		}
	}

	void PlayerAction(FRiftCombatState& State, const FString& ActionId, FRandomStream& Rng)
	{
		if (State.bFinished) return;
		FRiftCombatant* Self = Active(State);
		if (!Self || !Self->bIsPlayer || !Self->bAlive) return;
		FRiftCombatant* Target = Opponent(State, *Self);
		if (!Target) { CheckEnd(State); return; }

		if (ActionId == TEXT("powerup"))
		{
			Self->Output = FMath::Min(1.f, Self->Output + 0.15f);
			Self->Flux = FMath::Max(0, Self->Flux - 2);
			RefreshPL(*Self);
			PushLog(State, FString::Printf(TEXT("%s powers up — output %.0f%%, PL %s."),
				*Self->Name, Self->Output * 100.f, *RiftPower::FormatPL(Self->CachedPL)), TEXT("ascend"));
		}
		else if (ActionId == TEXT("guard"))
		{
			Self->Stagger = FMath::Max(0, Self->Stagger - 6);
			PushLog(State, FString::Printf(TEXT("%s holds guard and bleeds off stagger."), *Self->Name), TEXT("heal"));
		}
		else if (ActionId == TEXT("ascend"))
		{
			if (!Self->bAscended && Self->Flux >= 4)
			{
				Self->bAscended = true;
				Self->FormId = ERiftFormId::TemperedWake;
				Self->Flux -= 4;
				RefreshPL(*Self);
				PushLog(State, FString::Printf(TEXT("%s ascends into Tempered Wake! PL %s"),
					*Self->Name, *RiftPower::FormatPL(Self->CachedPL)), TEXT("ascend"));
			}
			else
			{
				PushLog(State, TEXT("Ascension fails — not enough Flux or already ascended."), TEXT("system"));
				return;
			}
		}
		else if (ActionId == TEXT("bolt"))
		{
			if (Self->Flux < 3)
			{
				PushLog(State, TEXT("Not enough Flux for a bolt."), TEXT("system"));
				return;
			}
			Self->Flux -= 3;
			DealDamage(State, *Self, *Target, 14 + Self->Attributes.Control, Rng);
		}
		else if (ActionId == TEXT("rush"))
		{
			if (Self->Flux < 2)
			{
				PushLog(State, TEXT("Not enough Flux for a rush."), TEXT("system"));
				return;
			}
			Self->Flux -= 2;
			PushLog(State, FString::Printf(TEXT("%s blinks in for a rush combo!"), *Self->Name), TEXT("attack"));
			DealDamage(State, *Self, *Target, 8 + Self->Attributes.Agility / 2, Rng);
			if (Target->bAlive)
			{
				DealDamage(State, *Self, *Target, 6 + Self->Attributes.Might / 3, Rng);
			}
		}
		else // strike
		{
			DealDamage(State, *Self, *Target, 10 + Self->Attributes.Might / 2, Rng);
		}

		CheckEnd(State);
		if (!State.bFinished)
		{
			NextTurn(State);
			if (!State.Combatants[State.ActiveIndex].bIsPlayer)
			{
				AdvanceEnemyTurn(State, Rng);
			}
		}
	}

	void AdvanceEnemyTurn(FRiftCombatState& State, FRandomStream& Rng)
	{
		while (!State.bFinished)
		{
			FRiftCombatant* Self = Active(State);
			if (!Self || Self->bIsPlayer || !Self->bAlive) break;
			FRiftCombatant* Target = Opponent(State, *Self);
			if (!Target) { CheckEnd(State); break; }

			const float Roll = Rng.FRand();
			if (Roll < 0.15f && Self->Flux >= 4 && !Self->bAscended)
			{
				Self->bAscended = true;
				Self->FormId = ERiftFormId::TemperedWake;
				Self->Flux -= 4;
				RefreshPL(*Self);
				PushLog(State, FString::Printf(TEXT("%s forces an ascension!"), *Self->Name), TEXT("ascend"));
			}
			else if (Roll < 0.35f && Self->Flux >= 3)
			{
				Self->Flux -= 3;
				DealDamage(State, *Self, *Target, 12 + Self->Attributes.Control, Rng);
			}
			else if (Roll < 0.55f && Self->Flux >= 2)
			{
				Self->Flux -= 2;
				PushLog(State, FString::Printf(TEXT("%s rushes!"), *Self->Name), TEXT("attack"));
				DealDamage(State, *Self, *Target, 7 + Self->Attributes.Agility / 2, Rng);
			}
			else if (Roll < 0.7f)
			{
				Self->Output = FMath::Min(1.f, Self->Output + 0.1f);
				RefreshPL(*Self);
				PushLog(State, FString::Printf(TEXT("%s powers up."), *Self->Name), TEXT("ascend"));
			}
			else
			{
				DealDamage(State, *Self, *Target, 9 + Self->Attributes.Might / 2, Rng);
			}

			CheckEnd(State);
			if (State.bFinished) break;
			NextTurn(State);
			if (State.Combatants.IsValidIndex(State.ActiveIndex) && State.Combatants[State.ActiveIndex].bIsPlayer)
			{
				break;
			}
		}
	}
}
