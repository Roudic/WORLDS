#pragma once

#include "CoreMinimal.h"
#include "RiftwakeTypes.h"

namespace RiftCombat
{
	FRiftCombatant PlayerToCombatant(const FRiftPlayerBuild& Player);
	FRiftCombatant MakeFoe(const FString& EncounterId, const FRiftPlayerBuild& Player, FRandomStream& Rng);
	FRiftCombatState StartEncounter(const FString& EncounterId, const FRiftPlayerBuild& Player, FRandomStream& Rng);
	void PlayerAction(FRiftCombatState& State, const FString& ActionId, FRandomStream& Rng);
	void AdvanceEnemyTurn(FRiftCombatState& State, FRandomStream& Rng);
	TArray<FString> AvailableActions(const FRiftCombatState& State);
}
