#pragma once

#include "CoreMinimal.h"
#include "RiftwakeTypes.h"

struct FRiftFormDef
{
	ERiftFormId Id = ERiftFormId::Base;
	FString Name;
	float Multiplier = 1.f;
	int32 EnergyDrain = 0;
	FString Description;
};

namespace RiftPower
{
	FRiftFormDef GetForm(ERiftFormId Id);
	FRiftBattleStats AttributesToBattleStats(const FRiftAttributes& A, const FRiftBattleStats& Trained = FRiftBattleStats());
	float AngerMultiplier(int32 Pressure);
	ERiftPowerBand BandFromPowerLevel(int64 PL);
	FString BandLabel(ERiftPowerBand Band);
	FRiftPowerReading ComputePowerLevel(const FRiftBattleStats& Stats, ERiftFormId FormId, float Output, int32 Pressure, int32 Level);
	FRiftPowerReading PlayerPower(const FRiftPlayerBuild& Player, float Output = 0.6f, int32 Pressure = 0, bool bAscended = false);
	FRiftPowerReading CombatantPower(const FRiftCombatant& C);
	FString FormatPL(int64 N);
	float PowerDamageMult(int64 AttackerPL, int64 DefenderPL);
}
