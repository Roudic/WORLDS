#include "WorldSystem.h"

namespace RiftWorlds
{
	static const TCHAR* WorldNames[] = {
		TEXT("Ashveil Reach"), TEXT("Cobalt Meridian"), TEXT("Thornwake Expanse"), TEXT("Glassline Basin"),
		TEXT("Red Orchard Belt"), TEXT("Nullharbor Drift"), TEXT("Iron Choir Ridge"), TEXT("Pale Current Isles")
	};

	static const TCHAR* Eras[] = {
		TEXT("First Fracture"), TEXT("Quiet Accord"), TEXT("Skyrail Century"), TEXT("Post-Axis Dawn"), TEXT("Merchant Wake")
	};

	FString ToneName(ERiftWorldTone Tone)
	{
		switch (Tone)
		{
		case ERiftWorldTone::War: return TEXT("war");
		case ERiftWorldTone::Intrigue: return TEXT("intrigue");
		case ERiftWorldTone::Discovery: return TEXT("discovery");
		case ERiftWorldTone::Survival: return TEXT("survival");
		case ERiftWorldTone::Ascension: return TEXT("ascension");
		default: return TEXT("politics");
		}
	}

	FString FluxName(ERiftFluxBias Bias)
	{
		switch (Bias)
		{
		case ERiftFluxBias::Pulse: return TEXT("pulse");
		case ERiftFluxBias::Aether: return TEXT("aether");
		case ERiftFluxBias::Lumen: return TEXT("lumen");
		case ERiftFluxBias::Riftforce: return TEXT("riftforce");
		default: return TEXT("hybrid");
		}
	}

	FString FocusName(ERiftWorldFocus Focus)
	{
		switch (Focus)
		{
		case ERiftWorldFocus::Growth: return TEXT("growth");
		case ERiftWorldFocus::Story: return TEXT("story");
		case ERiftWorldFocus::Threat: return TEXT("threat");
		default: return TEXT("balance");
		}
	}

	static TArray<FString> FactionsFor(ERiftWorldTone Tone)
	{
		switch (Tone)
		{
		case ERiftWorldTone::War:
			return { TEXT("Iron Wake Host"), TEXT("Scar Banner"), TEXT("Null Choir"), TEXT("Riftwardens") };
		case ERiftWorldTone::Intrigue:
			return { TEXT("Glass Synod"), TEXT("Ash Trade Guild"), TEXT("Skycoil Cartel"), TEXT("Quiet Path League") };
		case ERiftWorldTone::Discovery:
			return { TEXT("Chartwright Circle"), TEXT("Wild Choir"), TEXT("Harbor Compact"), TEXT("Pulse Archive") };
		case ERiftWorldTone::Survival:
			return { TEXT("Grainward Circle"), TEXT("Dust Compact"), TEXT("Last Rail Union"), TEXT("Shelter Vow") };
		case ERiftWorldTone::Ascension:
			return { TEXT("Tempered Order"), TEXT("Wake Tutors"), TEXT("Axis Remnant"), TEXT("Mythic Cell") };
		default:
			return { TEXT("Harbor Compact"), TEXT("Decree Chamber"), TEXT("Crossfall Seat"), TEXT("Faction of Three") };
		}
	}

	static FString ArcFor(ERiftWorldTone Tone)
	{
		switch (Tone)
		{
		case ERiftWorldTone::War: return TEXT("Open war of currents");
		case ERiftWorldTone::Intrigue: return TEXT("Knives under accords");
		case ERiftWorldTone::Discovery: return TEXT("Mapping the wells");
		case ERiftWorldTone::Survival: return TEXT("Hold the districts");
		case ERiftWorldTone::Ascension: return TEXT("Who earns the multiplier");
		default: return TEXT("Names on the decree");
		}
	}

	FRiftManagedWorld CreateWorld(ERiftWorldTone Tone, FRandomStream& Rng, const FString& Name)
	{
		const int32 Seed = Rng.RandRange(1, 2000000000) ^ Rng.RandHelper(1000000000);
		FRiftManagedWorld W;
		W.Seed = Seed;
		W.Id = FString::Printf(TEXT("world_%x"), Seed);
		W.Name = Name.IsEmpty()
			? FString::Printf(TEXT("%s %c"), WorldNames[FMath::Abs(Seed) % UE_ARRAY_COUNT(WorldNames)], TEXT('A') + (FMath::Abs(Seed) % 26))
			: Name;
		W.Era = Eras[FMath::Abs(Seed) % UE_ARRAY_COUNT(Eras)];
		W.Tone = Tone;
		W.FluxBias = static_cast<ERiftFluxBias>(FMath::Abs(Seed) % 5);
		W.PowerCeiling = (Tone == ERiftWorldTone::War || Tone == ERiftWorldTone::Ascension) ? 9000
			: (Tone == ERiftWorldTone::Survival) ? 3500
			: (Tone == ERiftWorldTone::Discovery) ? 5000
			: 4200;
		W.Stability = Tone == ERiftWorldTone::War ? 28 : Tone == ERiftWorldTone::Survival ? 35 : Tone == ERiftWorldTone::Intrigue ? 48 : 55;
		W.ThreatLevel = Tone == ERiftWorldTone::War ? 70 : Tone == ERiftWorldTone::Ascension ? 55 : Tone == ERiftWorldTone::Survival ? 50 : 35;
		W.StoryArc = ArcFor(Tone);
		const TArray<FString> Pool = FactionsFor(Tone);
		W.Factions.Add(Pool[FMath::Abs(Seed) % Pool.Num()]);
		W.Factions.Add(Pool[(FMath::Abs(Seed) >> 3) % Pool.Num()]);
		W.History.Add(FString::Printf(TEXT("World forged — %s tone, %s bias, ceiling %d."),
			*ToneName(Tone), *FluxName(W.FluxBias), W.PowerCeiling));
		W.Focus = ERiftWorldFocus::Balance;
		return W;
	}

	FRiftManagedWorld SetFocus(const FRiftManagedWorld& World, ERiftWorldFocus Focus)
	{
		FRiftManagedWorld W = World;
		W.Focus = Focus;
		W.History.Add(FString::Printf(TEXT("Focus set to %s."), *FocusName(Focus)));
		if (W.History.Num() > 40) W.History.RemoveAt(0, W.History.Num() - 40);
		return W;
	}

	FRiftManagedWorld RaiseCeiling(const FRiftManagedWorld& World, int32 Amount)
	{
		FRiftManagedWorld W = World;
		W.PowerCeiling += Amount;
		W.StoryProgress = FMath::Min(100, W.StoryProgress + 4);
		if (W.StoryProgress >= 75) W.StoryArc = TEXT("Endgame pressure");
		else if (W.StoryProgress >= 40) W.StoryArc = TEXT("Faction rupture");
		W.History.Add(FString::Printf(TEXT("Power ceiling raised to %d. Stronger events can appear."), W.PowerCeiling));
		if (W.History.Num() > 40) W.History.RemoveAt(0, W.History.Num() - 40);
		return W;
	}
}
