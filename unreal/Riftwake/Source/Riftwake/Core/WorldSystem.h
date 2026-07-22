#pragma once

#include "CoreMinimal.h"
#include "RiftwakeTypes.h"

namespace RiftWorlds
{
	FRiftManagedWorld CreateWorld(ERiftWorldTone Tone, FRandomStream& Rng, const FString& Name = FString());
	FRiftManagedWorld SetFocus(const FRiftManagedWorld& World, ERiftWorldFocus Focus);
	FRiftManagedWorld RaiseCeiling(const FRiftManagedWorld& World, int32 Amount = 1200);
	FString ToneName(ERiftWorldTone Tone);
	FString FluxName(ERiftFluxBias Bias);
	FString FocusName(ERiftWorldFocus Focus);
}
