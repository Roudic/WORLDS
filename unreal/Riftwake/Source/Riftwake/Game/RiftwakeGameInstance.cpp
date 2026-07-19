#include "RiftwakeGameInstance.h"
#include "Core/CharacterRoster.h"
#include "Core/CombatSystem.h"
#include "Core/DiceSystem.h"
#include "Core/EventGenerator.h"
#include "Core/PowerSystem.h"
#include "Core/WorldSystem.h"

void URiftwakeGameInstance::Init()
{
	Super::Init();
	Stream.GenerateNewSeed();
	GoTitle();
}

void URiftwakeGameInstance::NotifyChanged()
{
	OnStateChanged.Broadcast();
}

void URiftwakeGameInstance::GoTitle()
{
	Screen = ERiftGameScreen::Title;
	StatusLine = TEXT("Project Riftwake — Unreal PC vertical slice");
	NotifyChanged();
}

void URiftwakeGameInstance::GoCreate()
{
	Screen = ERiftGameScreen::Create;
	CreateNameDraft = TEXT("Wakeborn");
	StatusLine = TEXT("Name your fighter, then press Enter.");
	NotifyChanged();
}

void URiftwakeGameInstance::ConfirmCreate()
{
	Save = FRiftSaveGame();
	FRiftPlayerBuild Build = RiftRoster::MakeDefaultBuild(CreateNameDraft);
	FRiftRosterCharacter Char = RiftRoster::CreateCharacter(Build, Stream);
	Save.Characters.Add(Char);
	Save.ActiveCharacterId = Char.Id;
	CreateStarterWorld(ERiftWorldTone::Discovery);
	if (Save.Worlds.Num() > 0)
	{
		RiftRoster::PlaceCharacter(Save, Char.Id, Save.Worlds[0].Id);
	}
	GoHub();
}

void URiftwakeGameInstance::EnsureBootstrap()
{
	if (Save.Characters.Num() == 0)
	{
		ConfirmCreate();
	}
}

void URiftwakeGameInstance::GoHub()
{
	EnsureBootstrap();
	Screen = ERiftGameScreen::Hub;
	if (const FRiftRosterCharacter* C = RiftRoster::Active(Save))
	{
		const FRiftPowerReading PL = RiftPower::PlayerPower(C->Build);
		StatusLine = FString::Printf(TEXT("%s — PL %s (%s)"), *C->Build.Name, *RiftPower::FormatPL(PL.PowerLevel), *PL.BandLabel);
	}
	NotifyChanged();
}

void URiftwakeGameInstance::CreateStarterWorld(ERiftWorldTone Tone)
{
	FRiftManagedWorld W = RiftWorlds::CreateWorld(Tone, Stream);
	Save.Worlds.Add(W);
	Save.ActiveWorldId = W.Id;
	StatusLine = FString::Printf(TEXT("World forged: %s"), *W.Name);
	NotifyChanged();
}

const FRiftManagedWorld* URiftwakeGameInstance::ActiveWorld() const
{
	for (const FRiftManagedWorld& W : Save.Worlds)
	{
		if (W.Id == Save.ActiveWorldId) return &W;
	}
	return Save.Worlds.Num() ? &Save.Worlds[0] : nullptr;
}

FRiftManagedWorld* URiftwakeGameInstance::ActiveWorldMutable()
{
	for (FRiftManagedWorld& W : Save.Worlds)
	{
		if (W.Id == Save.ActiveWorldId) return &W;
	}
	return Save.Worlds.Num() ? &Save.Worlds[0] : nullptr;
}

void URiftwakeGameInstance::PlaceActiveOnWorld()
{
	if (Save.Worlds.Num() == 0)
	{
		CreateStarterWorld(ERiftWorldTone::War);
	}
	if (FRiftRosterCharacter* C = RiftRoster::ActiveMutable(Save))
	{
		RiftRoster::PlaceCharacter(Save, C->Id, Save.ActiveWorldId);
		StatusLine = FString::Printf(TEXT("%s stationed on world."), *C->Build.Name);
	}
	NotifyChanged();
}

void URiftwakeGameInstance::RollEvent()
{
	EnsureBootstrap();
	FRiftRosterCharacter* Char = RiftRoster::ActiveMutable(Save);
	const FRiftManagedWorld* World = ActiveWorld();
	if (!Char || !World)
	{
		StatusLine = TEXT("Need a character and a world first.");
		NotifyChanged();
		return;
	}
	if (Char->WorldId.IsEmpty())
	{
		PlaceActiveOnWorld();
	}
	const FRiftPowerReading PL = RiftPower::PlayerPower(Char->Build);
	const bool bSurge = Char->bReboundSurge;
	Char->CurrentEvent = RiftEvents::Generate(*World, Char->Build, PL.PowerLevel, Stream, bSurge);
	Char->bHasEvent = true;
	Char->bReboundSurge = false;
	if (FRiftManagedWorld* WM = ActiveWorldMutable())
	{
		++WM->EventCount;
	}
	Screen = ERiftGameScreen::Event;
	StatusLine = Char->CurrentEvent.Title;
	NotifyChanged();
}

void URiftwakeGameInstance::ApplyTrainingLean(FRiftRosterCharacter& Char, const TArray<FString>& Lean, bool bSuccess)
{
	const int32 Amount = bSuccess ? 8 : 4;
	auto ApplyOne = [&](const FString& Key)
	{
		if (Key == TEXT("strength")) Char.Build.TrainedStats.Add(ERiftBattleStat::Strength, Amount);
		else if (Key == TEXT("endurance")) Char.Build.TrainedStats.Add(ERiftBattleStat::Endurance, Amount);
		else if (Key == TEXT("speed")) Char.Build.TrainedStats.Add(ERiftBattleStat::Speed, Amount);
		else if (Key == TEXT("resistance")) Char.Build.TrainedStats.Add(ERiftBattleStat::Resistance, Amount);
		else if (Key == TEXT("offense")) Char.Build.TrainedStats.Add(ERiftBattleStat::Offense, Amount);
		else if (Key == TEXT("defense")) Char.Build.TrainedStats.Add(ERiftBattleStat::Defense, Amount);
		else if (Key == TEXT("force")) Char.Build.TrainedStats.Add(ERiftBattleStat::Force, Amount);
	};
	if (Lean.Num() == 0)
	{
		ApplyOne(TEXT("endurance"));
		return;
	}
	for (const FString& L : Lean)
	{
		ApplyOne(L.ToLower());
	}
}

void URiftwakeGameInstance::ResolveChoice(int32 ChoiceIndex)
{
	FRiftRosterCharacter* Char = RiftRoster::ActiveMutable(Save);
	if (!Char || !Char->bHasEvent) return;
	if (!Char->CurrentEvent.Choices.IsValidIndex(ChoiceIndex)) return;

	const FRiftEventChoice Choice = Char->CurrentEvent.Choices[ChoiceIndex];
	const FRiftDiceResult Roll = RiftDice::MakeCheck(Char->Build.Attributes.Get(Choice.Attribute), Choice.DC, Stream);
	StatusLine = Roll.Summary;

	const bool bForceBattle = Choice.Hint.Contains(TEXT("Battle"));
	const bool bEnterCombat = !Choice.StartCombat.IsEmpty() && (bForceBattle || Roll.bSuccess);
	if (bEnterCombat)
	{
		Save.bPendingCombat = true;
		Save.PendingEncounterId = Choice.StartCombat;
		Save.PendingReasonWin = Choice.ReasonWin;
		Save.PendingReasonLose = Choice.ReasonLose;
		Combat = RiftCombat::StartEncounter(Choice.StartCombat, Char->Build, Stream);
		Char->bHasEvent = false;
		Screen = ERiftGameScreen::Combat;
		StatusLine = Roll.Summary;
		NotifyChanged();
		return;
	}

	ApplyTrainingLean(*Char, Choice.Lean, Roll.bSuccess);
	++Char->TrainCount;
	const FString Reason = Roll.bSuccess ? Choice.ReasonWin : Choice.ReasonLose;
	Char->DevelopmentLog.Add(Reason);
	if (Char->DevelopmentLog.Num() > 30) Char->DevelopmentLog.RemoveAt(0, Char->DevelopmentLog.Num() - 30);
	Char->bHasEvent = false;
	StatusLine = Reason + TEXT(" | ") + Roll.Summary;
	GoHub();
}

void URiftwakeGameInstance::CombatAction(const FString& ActionId)
{
	if (Screen != ERiftGameScreen::Combat || Combat.bFinished) return;
	RiftCombat::PlayerAction(Combat, ActionId, Stream);
	if (Combat.bFinished)
	{
		FinishCombatToHub();
		return;
	}
	NotifyChanged();
}

void URiftwakeGameInstance::FinishCombatToHub()
{
	FRiftRosterCharacter* Char = RiftRoster::ActiveMutable(Save);
	if (Char)
	{
		if (Combat.bVictory)
		{
			Char->Build.TrainedStats.Add(ERiftBattleStat::Offense, 10);
			Char->Build.TrainedStats.Add(ERiftBattleStat::Strength, 6);
			Char->DevelopmentLog.Add(Save.PendingReasonWin.IsEmpty()
				? TEXT("Won the fight — power sharpened under real pressure.")
				: Save.PendingReasonWin);
			if (!Char->Build.bAscensionUnlocked && Char->TrainCount + Char->Build.TrainedStats.Sum() > 40)
			{
				Char->Build.bAscensionUnlocked = true;
				Char->DevelopmentLog.Add(TEXT("Tempered Wake unlocked — the Flux answered."));
			}
			StatusLine = TEXT("Victory. Gains earned.");
		}
		else
		{
			Char->Build.TrainedStats.Add(ERiftBattleStat::Endurance, 8);
			Char->Build.TrainedStats.Add(ERiftBattleStat::Resistance, 6);
			Char->bReboundSurge = true;
			Char->DevelopmentLog.Add(Save.PendingReasonLose.IsEmpty()
				? TEXT("Lost — the body keeps the lesson. Rebound Surge armed.")
				: Save.PendingReasonLose + TEXT(" Rebound Surge armed."));
			StatusLine = TEXT("Defeat. Rebound Surge will empower the next event.");
		}
	}
	Save.bPendingCombat = false;
	Save.PendingEncounterId.Reset();
	GoHub();
}

void URiftwakeGameInstance::TrainActive(ERiftBattleStat Stat)
{
	FRiftRosterCharacter* Char = RiftRoster::ActiveMutable(Save);
	if (!Char) return;
	const FRiftDiceResult Roll = RiftDice::MakeCheck(Char->Build.Attributes.Grit, 12, Stream);
	const int32 Amount = Roll.bSuccess ? 10 : 5;
	Char->Build.TrainedStats.Add(Stat, Amount);
	++Char->TrainCount;
	Char->DevelopmentLog.Add(FString::Printf(TEXT("Training session (%s) — %s"), *Roll.Summary, Roll.bSuccess ? TEXT("clean gains") : TEXT("hard lessons")));
	StatusLine = FString::Printf(TEXT("Trained +%d | %s"), Amount, *Roll.Summary);
	NotifyChanged();
}

void URiftwakeGameInstance::RaiseActiveWorldCeiling()
{
	if (FRiftManagedWorld* W = ActiveWorldMutable())
	{
		*W = RiftWorlds::RaiseCeiling(*W);
		StatusLine = FString::Printf(TEXT("Ceiling now %d"), W->PowerCeiling);
		NotifyChanged();
	}
}

FString URiftwakeGameInstance::BuildHudText() const
{
	FString Out;
	Out += TEXT("══════════════════════════════════════════\n");
	Out += TEXT("  RIFTWAKE  ·  Unreal Engine 5  ·  PC\n");
	Out += TEXT("══════════════════════════════════════════\n\n");

	if (Screen == ERiftGameScreen::Title)
	{
		Out += TEXT("Original martial-fantasy RPG vertical slice.\n");
		Out += TEXT("Power Level · Worlds · Generative events · Arena combat\n\n");
		Out += TEXT("[Enter] New game\n");
		Out += TEXT("[Esc]   Quit\n");
		return Out;
	}

	if (Screen == ERiftGameScreen::Create)
	{
		Out += TEXT("Create fighter\n\n");
		Out += FString::Printf(TEXT("Name: %s_\n\n"), *CreateNameDraft);
		Out += TEXT("[Tab] cycle name · [Enter] confirm · [Backspace] delete\n");
		return Out;
	}

	const FRiftRosterCharacter* Char = RiftRoster::Active(Save);
	const FRiftManagedWorld* World = nullptr;
	for (const FRiftManagedWorld& W : Save.Worlds)
	{
		if (W.Id == Save.ActiveWorldId) { World = &W; break; }
	}
	if (!World && Save.Worlds.Num()) World = &Save.Worlds[0];

	if (Screen == ERiftGameScreen::Hub && Char)
	{
		const FRiftPowerReading PL = RiftPower::PlayerPower(Char->Build);
		Out += FString::Printf(TEXT("Fighter: %s   Lv %d   PL %s (%s)\n"),
			*Char->Build.Name, Char->Build.Level, *RiftPower::FormatPL(PL.PowerLevel), *PL.BandLabel);
		Out += FString::Printf(TEXT("Form: %s   Ascension: %s   Rebound: %s\n"),
			*PL.FormName,
			Char->Build.bAscensionUnlocked ? TEXT("ready") : TEXT("locked"),
			Char->bReboundSurge ? TEXT("ARMED") : TEXT("—"));
		Out += FString::Printf(TEXT("Stats train: STR %d END %d SPD %d RES %d OFF %d DEF %d FOR %d\n\n"),
			Char->Build.TrainedStats.Strength, Char->Build.TrainedStats.Endurance, Char->Build.TrainedStats.Speed,
			Char->Build.TrainedStats.Resistance, Char->Build.TrainedStats.Offense, Char->Build.TrainedStats.Defense,
			Char->Build.TrainedStats.Force);
		if (World)
		{
			Out += FString::Printf(TEXT("World: %s  [%s / %s]\n"), *World->Name, *RiftWorlds::ToneName(World->Tone), *RiftWorlds::FluxName(World->FluxBias));
			Out += FString::Printf(TEXT("Ceiling %d · Stability %d · Threat %d · Arc: %s\n"),
				World->PowerCeiling, World->Stability, World->ThreatLevel, *World->StoryArc);
			Out += TEXT("Factions: ");
			Out += FString::Join(World->Factions, TEXT(", "));
			Out += TEXT("\n\n");
		}
		Out += FString::Printf(TEXT("Status: %s\n\n"), *StatusLine);
		Out += TEXT("[1] Roll generative event\n");
		Out += TEXT("[2] Train Strength   [3] Train Endurance   [4] Train Speed\n");
		Out += TEXT("[5] Raise world ceiling\n");
		Out += TEXT("[6] Forge war world   [7] Forge ascension world\n");
		Out += TEXT("[8] Quick duel (sandbox)\n");
		Out += TEXT("[9] Add second character\n");
		return Out;
	}

	if (Screen == ERiftGameScreen::Event && Char && Char->bHasEvent)
	{
		const FRiftWorldEvent& E = Char->CurrentEvent;
		Out += FString::Printf(TEXT("%s\n"), *E.Title);
		Out += FString::Printf(TEXT("[%s]\n\n"), *E.Tag);
		Out += E.Body + TEXT("\n\n");
		for (int32 i = 0; i < E.Choices.Num(); ++i)
		{
			Out += FString::Printf(TEXT("[%d] %s\n    %s\n"), i + 1, *E.Choices[i].Label, *E.Choices[i].Hint);
		}
		Out += TEXT("\nPress 1-3 to choose.\n");
		return Out;
	}

	if (Screen == ERiftGameScreen::Combat)
	{
		Out += FString::Printf(TEXT("COMBAT — Round %d — %s\n\n"), Combat.Round, *Combat.Name);
		for (const FRiftCombatant& C : Combat.Combatants)
		{
			Out += FString::Printf(TEXT("%s%s  HP %d/%d  Flux %d/%d  PL %s  %s\n"),
				C.bIsPlayer ? TEXT("▶ ") : TEXT("  "),
				*C.Name, C.Vitality, C.MaxVitality, C.Flux, C.MaxFlux,
				*RiftPower::FormatPL(C.CachedPL),
				C.bAscended ? TEXT("[ASCENDED]") : TEXT(""));
		}
		Out += TEXT("\n");
		const int32 Start = FMath::Max(0, Combat.Log.Num() - 8);
		for (int32 i = Start; i < Combat.Log.Num(); ++i)
		{
			Out += Combat.Log[i].Text + TEXT("\n");
		}
		Out += TEXT("\n[1] Strike  [2] Rush  [3] Bolt  [4] Power Up  [5] Guard  [6] Ascend\n");
		return Out;
	}

	Out += StatusLine;
	return Out;
}
