#include "DiceSystem.h"

namespace RiftDice
{
	int32 RollDie(int32 Sides, FRandomStream& Rng)
	{
		return Rng.RandRange(1, FMath::Max(2, Sides));
	}

	int32 Modifier(int32 AttributeValue)
	{
		return FMath::FloorToInt((AttributeValue - 10) / 2.f);
	}

	ERiftOutcomeTier OutcomeFromMargin(int32 Margin)
	{
		if (Margin <= -10) return ERiftOutcomeTier::SevereFailure;
		if (Margin < 0) return ERiftOutcomeTier::Failure;
		if (Margin >= 10) return ERiftOutcomeTier::ExceptionalSuccess;
		if (Margin >= 5) return ERiftOutcomeTier::StrongSuccess;
		return ERiftOutcomeTier::Success;
	}

	bool IsSuccess(ERiftOutcomeTier Tier)
	{
		return Tier == ERiftOutcomeTier::Success
			|| Tier == ERiftOutcomeTier::StrongSuccess
			|| Tier == ERiftOutcomeTier::ExceptionalSuccess;
	}

	static FString TierName(ERiftOutcomeTier Tier)
	{
		switch (Tier)
		{
		case ERiftOutcomeTier::SevereFailure: return TEXT("severe failure");
		case ERiftOutcomeTier::Failure: return TEXT("failure");
		case ERiftOutcomeTier::StrongSuccess: return TEXT("strong success");
		case ERiftOutcomeTier::ExceptionalSuccess: return TEXT("exceptional success");
		default: return TEXT("success");
		}
	}

	FRiftDiceResult MakeCheck(int32 AttributeValue, int32 DC, FRandomStream& Rng, int32 Proficiency)
	{
		const int32 Natural = RollDie(20, Rng);
		const int32 Mod = Modifier(AttributeValue) + Proficiency;
		FRiftDiceResult R;
		R.Natural = Natural;
		R.Total = Natural + Mod;
		R.DC = DC;
		R.Margin = R.Total - DC;
		R.Tier = OutcomeFromMargin(R.Margin);
		if (Natural == 20 && R.Tier < ERiftOutcomeTier::ExceptionalSuccess)
		{
			R.Tier = static_cast<ERiftOutcomeTier>(static_cast<uint8>(R.Tier) + 1);
		}
		if (Natural == 1 && R.Tier > ERiftOutcomeTier::SevereFailure)
		{
			R.Tier = static_cast<ERiftOutcomeTier>(static_cast<uint8>(R.Tier) - 1);
		}
		R.bSuccess = IsSuccess(R.Tier);
		R.Summary = FString::Printf(TEXT("d20=%d %+d = %d vs DC %d (%s)"), Natural, Mod, R.Total, DC, *TierName(R.Tier));
		return R;
	}
}
