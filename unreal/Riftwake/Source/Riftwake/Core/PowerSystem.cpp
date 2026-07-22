#include "PowerSystem.h"

namespace RiftPower
{
	FRiftFormDef GetForm(ERiftFormId Id)
	{
		FRiftFormDef F;
		F.Id = Id;
		switch (Id)
		{
		case ERiftFormId::TemperedWake:
			F.Name = TEXT("Tempered Wake");
			F.Multiplier = 2.5f;
			F.EnergyDrain = 2;
			F.Description = TEXT("First controlled transform. Power Level ×2.5");
			break;
		case ERiftFormId::TemperedMaster:
			F.Name = TEXT("Tempered Wake (Mastered)");
			F.Multiplier = 4.f;
			F.EnergyDrain = 1;
			F.Description = TEXT("Stabilized wake. Power Level ×4, lower drain.");
			break;
		case ERiftFormId::RiftSync:
			F.Name = TEXT("Rift Sync");
			F.Multiplier = 8.f;
			F.EnergyDrain = 3;
			F.Description = TEXT("Dangerous sync with Axis feedback. Power Level ×8");
			break;
		case ERiftFormId::MythicWake:
			F.Name = TEXT("Mythic Wake");
			F.Multiplier = 15.f;
			F.EnergyDrain = 4;
			F.Description = TEXT("Endgame surge. Power Level ×15");
			break;
		default:
			F.Name = TEXT("Base Form");
			F.Multiplier = 1.f;
			F.EnergyDrain = 0;
			F.Description = TEXT("Your natural output. No multiplier.");
			break;
		}
		return F;
	}

	FRiftBattleStats AttributesToBattleStats(const FRiftAttributes& A, const FRiftBattleStats& Trained)
	{
		FRiftBattleStats B;
		B.Strength = A.Might * 12 + Trained.Strength;
		B.Endurance = A.Grit * 12 + Trained.Endurance;
		B.Speed = A.Agility * 12 + Trained.Speed;
		B.Resistance = A.Will * 12 + Trained.Resistance;
		B.Offense = FMath::RoundToInt((A.Might + A.Presence) * 6.f) + Trained.Offense;
		B.Defense = FMath::RoundToInt((A.Grit + A.Agility) * 6.f) + Trained.Defense;
		B.Force = A.Control * 12 + Trained.Force;
		return B;
	}

	float AngerMultiplier(int32 Pressure)
	{
		return 1.f + FMath::Min(0.5f, Pressure * 0.04f);
	}

	ERiftPowerBand BandFromPowerLevel(int64 PL)
	{
		if (PL >= 5000000) return ERiftPowerBand::Mythic;
		if (PL >= 800000) return ERiftPowerBand::Sovereign;
		if (PL >= 120000) return ERiftPowerBand::Astral;
		if (PL >= 25000) return ERiftPowerBand::WorldClass;
		if (PL >= 6000) return ERiftPowerBand::Ascendant;
		if (PL >= 1200) return ERiftPowerBand::Awakened;
		return ERiftPowerBand::Mortal;
	}

	FString BandLabel(ERiftPowerBand Band)
	{
		switch (Band)
		{
		case ERiftPowerBand::Awakened: return TEXT("Awakened");
		case ERiftPowerBand::Ascendant: return TEXT("Ascendant");
		case ERiftPowerBand::WorldClass: return TEXT("World-Class");
		case ERiftPowerBand::Astral: return TEXT("Astral");
		case ERiftPowerBand::Sovereign: return TEXT("Sovereign");
		case ERiftPowerBand::Mythic: return TEXT("Mythic");
		default: return TEXT("Mortal");
		}
	}

	FRiftPowerReading ComputePowerLevel(const FRiftBattleStats& Stats, ERiftFormId FormId, float Output, int32 Pressure, int32 Level)
	{
		const FRiftFormDef Form = GetForm(FormId);
		const int32 Total = Stats.Sum();
		const float Anger = AngerMultiplier(Pressure);
		const float LevelPad = 1.f + (FMath::Max(1, Level) - 1) * 0.03f;
		const int64 PL = FMath::Max<int64>(1, FMath::FloorToInt64(Total * Form.Multiplier * Output * Anger * LevelPad));
		const int64 Shown = FMath::Max<int64>(1, FMath::FloorToInt64(PL * FMath::Min(1.f, Output / 0.6f)));
		const ERiftPowerBand Band = BandFromPowerLevel(PL);

		FRiftPowerReading R;
		R.Stats = Stats;
		R.StatTotal = Total;
		R.FormId = Form.Id;
		R.FormName = Form.Name;
		R.FormMultiplier = Form.Multiplier;
		R.Output = Output;
		R.AngerMult = Anger;
		R.PowerLevel = PL;
		R.ShownPowerLevel = Shown;
		R.Band = Band;
		R.BandLabel = BandLabel(Band);
		return R;
	}

	FRiftPowerReading PlayerPower(const FRiftPlayerBuild& Player, float Output, int32 Pressure, bool bAscended)
	{
		const FRiftBattleStats Stats = AttributesToBattleStats(Player.Attributes, Player.TrainedStats);
		ERiftFormId FormId = Player.FormId;
		if (bAscended && FormId == ERiftFormId::Base)
		{
			if (Player.AscensionMastery >= 2) FormId = ERiftFormId::TemperedMaster;
			else if (Player.bAscensionUnlocked) FormId = ERiftFormId::TemperedWake;
		}
		return ComputePowerLevel(Stats, FormId, Output, Pressure, Player.Level);
	}

	FRiftPowerReading CombatantPower(const FRiftCombatant& C)
	{
		ERiftFormId FormId = C.bAscended ? (C.FormId == ERiftFormId::Base ? ERiftFormId::TemperedWake : C.FormId) : ERiftFormId::Base;
		const FRiftBattleStats Stats = AttributesToBattleStats(C.Attributes);
		return ComputePowerLevel(Stats, FormId, C.Output, C.Pressure, C.Level);
	}

	FString FormatPL(int64 N)
	{
		if (N >= 1000000)
		{
			return FString::Printf(TEXT("%.2fM"), N / 1000000.0);
		}
		if (N >= 10000)
		{
			return FString::Printf(TEXT("%.1fK"), N / 1000.0);
		}
		return FString::FormatAsNumber(static_cast<int32>(N));
	}

	float PowerDamageMult(int64 AttackerPL, int64 DefenderPL)
	{
		if (DefenderPL <= 0) return 1.f;
		const double Ratio = static_cast<double>(AttackerPL) / static_cast<double>(DefenderPL);
		if (Ratio >= 3.0) return 2.2f;
		if (Ratio >= 1.5) return 1.4f;
		if (Ratio >= 0.85) return 1.f;
		if (Ratio >= 0.5) return 0.55f;
		if (Ratio >= 0.25) return 0.25f;
		return 0.08f;
	}

	float HiddenDepthFactor(int32 Will, int32 Grit, int32 Level)
	{
		const float Base = 0.15f + (Will + Grit) * 0.006f + FMath::Max(0, Level - 1) * 0.012f;
		return FMath::Clamp(Base, 0.15f, 0.5f);
	}

	float MomentumDamageMult(int32 Momentum)
	{
		const float M = FMath::Clamp(static_cast<float>(Momentum), -100.f, 100.f);
		return 1.f + (M / 100.f) * (M >= 0.f ? 0.35f : 0.3f);
	}

	int64 EffectivePowerLevel(int64 BasePL, int32 Momentum, float VitalityPct, bool bDepthsAwakened, float HiddenDepth)
	{
		double PL = static_cast<double>(BasePL);
		if (bDepthsAwakened && HiddenDepth > 0.f) PL *= (1.0 + HiddenDepth);
		if (VitalityPct < 0.25f) PL *= 1.08;
		PL *= MomentumDamageMult(Momentum);
		return FMath::Max<int64>(1, FMath::RoundToInt64(PL));
	}

	int64 SuppressedReading(int64 RealPL, float Suppression)
	{
		const float S = FMath::Clamp(Suppression, 0.f, 0.9f);
		return FMath::Max<int64>(1, FMath::RoundToInt64(RealPL * (1.f - S)));
	}
}
