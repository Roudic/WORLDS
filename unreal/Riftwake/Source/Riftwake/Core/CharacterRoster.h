#pragma once

#include "CoreMinimal.h"
#include "RiftwakeTypes.h"

namespace RiftRoster
{
	FRiftRosterCharacter CreateCharacter(const FRiftPlayerBuild& Build, FRandomStream& Rng);
	FRiftRosterCharacter* FindMutable(FRiftSaveGame& Save, const FString& CharacterId);
	const FRiftRosterCharacter* Find(const FRiftSaveGame& Save, const FString& CharacterId);
	FRiftRosterCharacter* ActiveMutable(FRiftSaveGame& Save);
	const FRiftRosterCharacter* Active(const FRiftSaveGame& Save);
	bool SelectCharacter(FRiftSaveGame& Save, const FString& CharacterId);
	bool PlaceCharacter(FRiftSaveGame& Save, const FString& CharacterId, const FString& WorldId);
	TArray<FRiftRosterCharacter> CharactersOnWorld(const FRiftSaveGame& Save, const FString& WorldId);
	FRiftPlayerBuild MakeDefaultBuild(const FString& Name);
}
