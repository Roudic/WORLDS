#pragma once

#include "CoreMinimal.h"
#include "RiftwakeTypes.generated.h"

UENUM(BlueprintType)
enum class ERiftPowerBand : uint8
{
	Mortal UMETA(DisplayName = "Mortal"),
	Awakened UMETA(DisplayName = "Awakened"),
	Ascendant UMETA(DisplayName = "Ascendant"),
	WorldClass UMETA(DisplayName = "World-Class"),
	Astral UMETA(DisplayName = "Astral"),
	Sovereign UMETA(DisplayName = "Sovereign"),
	Mythic UMETA(DisplayName = "Mythic")
};

UENUM(BlueprintType)
enum class ERiftFormId : uint8
{
	Base UMETA(DisplayName = "Base Form"),
	TemperedWake UMETA(DisplayName = "Tempered Wake"),
	TemperedMaster UMETA(DisplayName = "Tempered Wake (Mastered)"),
	RiftSync UMETA(DisplayName = "Rift Sync"),
	MythicWake UMETA(DisplayName = "Mythic Wake")
};

UENUM(BlueprintType)
enum class ERiftWorldTone : uint8
{
	War,
	Intrigue,
	Discovery,
	Survival,
	Ascension,
	Politics
};

UENUM(BlueprintType)
enum class ERiftFluxBias : uint8
{
	Pulse,
	Aether,
	Lumen,
	Riftforce,
	Hybrid
};

UENUM(BlueprintType)
enum class ERiftWorldFocus : uint8
{
	Balance,
	Growth,
	Story,
	Threat
};

UENUM(BlueprintType)
enum class ERiftAttributeId : uint8
{
	Might,
	Grit,
	Agility,
	Will,
	Presence,
	Intellect,
	Control
};

UENUM(BlueprintType)
enum class ERiftBattleStat : uint8
{
	Strength,
	Endurance,
	Speed,
	Resistance,
	Offense,
	Defense,
	Force
};

UENUM(BlueprintType)
enum class ERiftGameScreen : uint8
{
	Title,
	Create,
	Hub,
	Event,
	Combat,
	Arena
};

USTRUCT(BlueprintType)
struct FRiftAttributes
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Might = 12;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Grit = 12;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Agility = 12;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Will = 12;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Presence = 12;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Intellect = 12;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Control = 12;

	int32 Get(ERiftAttributeId Id) const
	{
		switch (Id)
		{
		case ERiftAttributeId::Might: return Might;
		case ERiftAttributeId::Grit: return Grit;
		case ERiftAttributeId::Agility: return Agility;
		case ERiftAttributeId::Will: return Will;
		case ERiftAttributeId::Presence: return Presence;
		case ERiftAttributeId::Intellect: return Intellect;
		case ERiftAttributeId::Control: return Control;
		}
		return 10;
	}
};

USTRUCT(BlueprintType)
struct FRiftBattleStats
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Strength = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Endurance = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Speed = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Resistance = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Offense = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Defense = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Force = 0;

	int32 Sum() const
	{
		return Strength + Endurance + Speed + Resistance + Offense + Defense + Force;
	}

	void Add(ERiftBattleStat Stat, int32 Amount)
	{
		switch (Stat)
		{
		case ERiftBattleStat::Strength: Strength += Amount; break;
		case ERiftBattleStat::Endurance: Endurance += Amount; break;
		case ERiftBattleStat::Speed: Speed += Amount; break;
		case ERiftBattleStat::Resistance: Resistance += Amount; break;
		case ERiftBattleStat::Offense: Offense += Amount; break;
		case ERiftBattleStat::Defense: Defense += Amount; break;
		case ERiftBattleStat::Force: Force += Amount; break;
		}
	}
};

USTRUCT(BlueprintType)
struct FRiftPowerReading
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) FRiftBattleStats Stats;
	UPROPERTY(BlueprintReadOnly) int32 StatTotal = 0;
	UPROPERTY(BlueprintReadOnly) ERiftFormId FormId = ERiftFormId::Base;
	UPROPERTY(BlueprintReadOnly) FString FormName;
	UPROPERTY(BlueprintReadOnly) float FormMultiplier = 1.f;
	UPROPERTY(BlueprintReadOnly) float Output = 0.6f;
	UPROPERTY(BlueprintReadOnly) float AngerMult = 1.f;
	UPROPERTY(BlueprintReadOnly) int64 PowerLevel = 1;
	UPROPERTY(BlueprintReadOnly) int64 ShownPowerLevel = 1;
	UPROPERTY(BlueprintReadOnly) ERiftPowerBand Band = ERiftPowerBand::Mortal;
	UPROPERTY(BlueprintReadOnly) FString BandLabel;
};

USTRUCT(BlueprintType)
struct FRiftPlayerBuild
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Name = TEXT("Wakeborn");
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Origin = TEXT("Crossfall");
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Discipline = TEXT("Pulse");
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FRiftAttributes Attributes;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FRiftBattleStats TrainedStats;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Level = 1;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Resolve = 2;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) ERiftPowerBand PowerBand = ERiftPowerBand::Mortal;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) ERiftFormId FormId = ERiftFormId::Base;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) bool bAscensionUnlocked = false;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 AscensionMastery = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) TArray<FString> Techniques;
};

USTRUCT(BlueprintType)
struct FRiftEventChoice
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) FString Id;
	UPROPERTY(BlueprintReadOnly) FString Label;
	UPROPERTY(BlueprintReadOnly) FString Hint;
	UPROPERTY(BlueprintReadOnly) ERiftAttributeId Attribute = ERiftAttributeId::Might;
	UPROPERTY(BlueprintReadOnly) int32 DC = 12;
	UPROPERTY(BlueprintReadOnly) TArray<FString> Lean;
	UPROPERTY(BlueprintReadOnly) FString StartCombat;
	UPROPERTY(BlueprintReadOnly) FString ReasonWin;
	UPROPERTY(BlueprintReadOnly) FString ReasonLose;
};

USTRUCT(BlueprintType)
struct FRiftWorldEvent
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) FString Id;
	UPROPERTY(BlueprintReadOnly) FString Title;
	UPROPERTY(BlueprintReadOnly) FString Tag;
	UPROPERTY(BlueprintReadOnly) FString Kind;
	UPROPERTY(BlueprintReadOnly) FString Body;
	UPROPERTY(BlueprintReadOnly) TArray<FRiftEventChoice> Choices;
};

USTRUCT(BlueprintType)
struct FRiftManagedWorld
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) FString Id;
	UPROPERTY(BlueprintReadOnly) FString Name;
	UPROPERTY(BlueprintReadOnly) int32 Seed = 0;
	UPROPERTY(BlueprintReadOnly) FString Era;
	UPROPERTY(BlueprintReadOnly) ERiftFluxBias FluxBias = ERiftFluxBias::Hybrid;
	UPROPERTY(BlueprintReadOnly) ERiftWorldTone Tone = ERiftWorldTone::Discovery;
	UPROPERTY(BlueprintReadOnly) int32 PowerCeiling = 4200;
	UPROPERTY(BlueprintReadOnly) int32 Stability = 55;
	UPROPERTY(BlueprintReadOnly) int32 ThreatLevel = 35;
	UPROPERTY(BlueprintReadOnly) FString StoryArc;
	UPROPERTY(BlueprintReadOnly) int32 StoryProgress = 0;
	UPROPERTY(BlueprintReadOnly) TArray<FString> Factions;
	UPROPERTY(BlueprintReadOnly) TArray<FString> History;
	UPROPERTY(BlueprintReadOnly) int32 EventCount = 0;
	UPROPERTY(BlueprintReadOnly) ERiftWorldFocus Focus = ERiftWorldFocus::Balance;
};

USTRUCT(BlueprintType)
struct FRiftRosterCharacter
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) FString Id;
	UPROPERTY(BlueprintReadOnly) FRiftPlayerBuild Build;
	UPROPERTY(BlueprintReadOnly) FString WorldId;
	UPROPERTY(BlueprintReadOnly) int32 TrainCount = 0;
	UPROPERTY(BlueprintReadOnly) TArray<FString> DevelopmentLog;
	UPROPERTY(BlueprintReadOnly) FRiftWorldEvent CurrentEvent;
	UPROPERTY(BlueprintReadOnly) bool bHasEvent = false;
	UPROPERTY(BlueprintReadOnly) bool bReboundSurge = false;
};

USTRUCT(BlueprintType)
struct FRiftCombatant
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) FString Id;
	UPROPERTY(BlueprintReadOnly) FString Name;
	UPROPERTY(BlueprintReadOnly) bool bIsPlayer = false;
	UPROPERTY(BlueprintReadOnly) FRiftAttributes Attributes;
	UPROPERTY(BlueprintReadOnly) int32 Level = 1;
	UPROPERTY(BlueprintReadOnly) int32 Vitality = 40;
	UPROPERTY(BlueprintReadOnly) int32 MaxVitality = 40;
	UPROPERTY(BlueprintReadOnly) int32 Flux = 20;
	UPROPERTY(BlueprintReadOnly) int32 MaxFlux = 20;
	UPROPERTY(BlueprintReadOnly) int32 Stagger = 0;
	UPROPERTY(BlueprintReadOnly) int32 MaxStagger = 20;
	UPROPERTY(BlueprintReadOnly) int32 Pressure = 0;
	UPROPERTY(BlueprintReadOnly) float Output = 0.6f;
	UPROPERTY(BlueprintReadOnly) bool bAscended = false;
	UPROPERTY(BlueprintReadOnly) ERiftFormId FormId = ERiftFormId::Base;
	UPROPERTY(BlueprintReadOnly) bool bAlive = true;
	UPROPERTY(BlueprintReadOnly) int64 CachedPL = 1;
};

USTRUCT(BlueprintType)
struct FRiftCombatLogEntry
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) FString Text;
	UPROPERTY(BlueprintReadOnly) FString Kind;
};

USTRUCT(BlueprintType)
struct FRiftCombatState
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) FString Id;
	UPROPERTY(BlueprintReadOnly) FString Name;
	UPROPERTY(BlueprintReadOnly) FString Description;
	UPROPERTY(BlueprintReadOnly) TArray<FRiftCombatant> Combatants;
	UPROPERTY(BlueprintReadOnly) int32 ActiveIndex = 0;
	UPROPERTY(BlueprintReadOnly) int32 Round = 1;
	UPROPERTY(BlueprintReadOnly) TArray<FRiftCombatLogEntry> Log;
	UPROPERTY(BlueprintReadOnly) bool bFinished = false;
	UPROPERTY(BlueprintReadOnly) bool bVictory = false;
};

USTRUCT(BlueprintType)
struct FRiftSaveGame
{
	GENERATED_BODY()

	UPROPERTY() int32 Version = 1;
	UPROPERTY() TArray<FRiftRosterCharacter> Characters;
	UPROPERTY() TArray<FRiftManagedWorld> Worlds;
	UPROPERTY() FString ActiveCharacterId;
	UPROPERTY() FString ActiveWorldId;
	UPROPERTY() bool bPendingCombat = false;
	UPROPERTY() FString PendingEncounterId;
	UPROPERTY() FString PendingReasonWin;
	UPROPERTY() FString PendingReasonLose;
};
