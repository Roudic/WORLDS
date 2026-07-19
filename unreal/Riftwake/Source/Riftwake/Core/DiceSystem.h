#pragma once

#include "CoreMinimal.h"

enum class ERiftOutcomeTier : uint8
{
	SevereFailure,
	Failure,
	Success,
	StrongSuccess,
	ExceptionalSuccess
};

struct FRiftDiceResult
{
	int32 Total = 0;
	int32 DC = 12;
	int32 Margin = 0;
	int32 Natural = 0;
	ERiftOutcomeTier Tier = ERiftOutcomeTier::Failure;
	bool bSuccess = false;
	FString Summary;
};

namespace RiftDice
{
	int32 RollDie(int32 Sides, FRandomStream& Rng);
	int32 Modifier(int32 AttributeValue);
	ERiftOutcomeTier OutcomeFromMargin(int32 Margin);
	FRiftDiceResult MakeCheck(int32 AttributeValue, int32 DC, FRandomStream& Rng, int32 Proficiency = 0);
	bool IsSuccess(ERiftOutcomeTier Tier);
}
