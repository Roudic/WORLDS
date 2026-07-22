#pragma once

#include "CoreMinimal.h"
#include "RiftwakeTypes.h"

namespace RiftEvents
{
	FRiftWorldEvent Generate(const FRiftManagedWorld& World, const FRiftPlayerBuild& Player, int64 PowerLevel, FRandomStream& Rng, bool bReboundSurge = false);
	FString GenName(FRandomStream& Rng);
}
