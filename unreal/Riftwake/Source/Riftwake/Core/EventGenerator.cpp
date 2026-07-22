#include "EventGenerator.h"
#include "PowerSystem.h"

namespace RiftEvents
{
	static const TCHAR* SylA[] = {
		TEXT("Ka"), TEXT("Ve"), TEXT("Zor"), TEXT("Na"), TEXT("Ry"), TEXT("Tal"), TEXT("Bru"), TEXT("Sha"),
		TEXT("Or"), TEXT("Dre"), TEXT("Vol"), TEXT("Mi"), TEXT("Ax"), TEXT("Ce"), TEXT("Ju"), TEXT("Gr")
	};
	static const TCHAR* SylB[] = {
		TEXT("el"), TEXT("ma"), TEXT("ric"), TEXT("ka"), TEXT("dos"), TEXT("wyn"), TEXT("za"), TEXT("ren"),
		TEXT("ta"), TEXT("gor"), TEXT("ix"), TEXT("un"), TEXT("eth"), TEXT("ov"), TEXT("ash"), TEXT("il")
	};
	static const TCHAR* Epithets[] = {
		TEXT("the Ruinous"), TEXT("of the Ninth Fleet"), TEXT("the Quiet Fang"), TEXT("the Unbent"),
		TEXT("of the Ash Choir"), TEXT("the Ceiling-Breaker"), TEXT("the Ninefold"), TEXT("of the Long Fall"),
		TEXT("the Patient Storm"), TEXT("the Grinning Wall")
	};
	static const TCHAR* Arrivals[] = {
		TEXT("a burning pod shears the clouds and craters the plaza"),
		TEXT("a scanner wave rolls over the district and every screen whites out"),
		TEXT("the sky splits with a pressure front that flattens market stalls"),
		TEXT("a silhouette descends slowly, arms crossed, letting everyone watch"),
		TEXT("three moons of dust rise where something lands beyond the ridge")
	};
	static const TCHAR* Demands[] = {
		TEXT("the strongest fighter on this world, or the district burns"),
		TEXT("tribute in Flux cores by dawn"),
		TEXT("a duel with whoever the crowds call champion"),
		TEXT("the location of a buried Rift Shard"),
		TEXT("an heir to train — or a city to break")
	};
	static const TCHAR* Trainings[] = {
		TEXT("a canyon where gravity plates triple your weight"),
		TEXT("a breath-hall where you strike until your knuckles read the air"),
		TEXT("a flooded shaft where every kick fights the current"),
		TEXT("a scream-forge where output must stay pinned at the redline"),
		TEXT("a blindfold circuit strung with live current wires")
	};
	static const TCHAR* Stakes[] = {
		TEXT("the winner names the next law of the arena"),
		TEXT("the loser leaves this world for a season"),
		TEXT("the purse is a sealed Flux core nobody can price"),
		TEXT("the crowd decides who gets the mentor's last lesson"),
		TEXT("the champion holds the district's shield-key")
	};
	static const TCHAR* Relics[] = {
		TEXT("Rift Shard"), TEXT("Ember Core"), TEXT("Hollow Bell"), TEXT("Wake Anchor"), TEXT("Null Prism")
	};

	template <typename T, SIZE_T N>
	static const T& Pick(FRandomStream& Rng, const T (&Arr)[N])
	{
		return Arr[Rng.RandHelper(static_cast<int32>(N))];
	}

	FString GenName(FRandomStream& Rng)
	{
		FString Base = FString(Pick(Rng, SylA)) + Pick(Rng, SylB);
		if (Rng.FRand() < 0.35f)
		{
			static const TCHAR* SylC[] = { TEXT("ar"), TEXT("is"), TEXT("or"), TEXT("ax"), TEXT("on"), TEXT("us") };
			Base += Pick(Rng, SylC);
		}
		if (Base.Len() > 0)
		{
			Base[0] = TChar<TCHAR>::ToUpper(Base[0]);
		}
		return Base;
	}

	static FString GenFoe(FRandomStream& Rng)
	{
		return Rng.FRand() < 0.5f
			? FString::Printf(TEXT("%s %s"), *GenName(Rng), Pick(Rng, Epithets))
			: GenName(Rng);
	}

	static int32 DC(FRandomStream& Rng, int32 Base = 12)
	{
		return Base + Rng.RandHelper(4) - 1;
	}

	static FRiftEventChoice BattleChoice(
		FRandomStream& Rng,
		const FString& Label,
		const FString& Encounter,
		ERiftAttributeId Attr,
		const FString& Win,
		const FString& Lose)
	{
		FRiftEventChoice C;
		C.Id = FString::Printf(TEXT("gen_fight_%x"), Rng.RandHelper(1000000));
		C.Label = Label;
		C.Hint = TEXT("Battle — real combat decides it");
		C.Attribute = Attr;
		C.DC = DC(Rng, 11);
		C.StartCombat = Encounter;
		C.ReasonWin = Win;
		C.ReasonLose = Lose;
		C.Lean = { TEXT("offense"), TEXT("strength") };
		return C;
	}

	static FRiftEventChoice SkillChoice(
		FRandomStream& Rng,
		const FString& Label,
		const FString& Hint,
		ERiftAttributeId Attr,
		const FString& Win,
		const FString& Lose,
		const FString& StartCombat = FString())
	{
		FRiftEventChoice C;
		C.Id = FString::Printf(TEXT("gen_%x"), Rng.RandHelper(1000000));
		C.Label = Label;
		C.Hint = Hint;
		C.Attribute = Attr;
		C.DC = DC(Rng);
		C.ReasonWin = Win;
		C.ReasonLose = Lose;
		C.StartCombat = StartCombat;
		C.Lean = { TEXT("endurance"), TEXT("resistance") };
		return C;
	}

	static FRiftWorldEvent MakeInvader(const FRiftManagedWorld& World, const FRiftPlayerBuild& Player, int64 PL, FRandomStream& Rng)
	{
		const FString Foe = GenFoe(Rng);
		const float Mult = 0.8f + Rng.FRand() * 1.1f;
		const FString FoePl = RiftPower::FormatPL(FMath::RoundToInt64(PL * Mult));
		FRiftWorldEvent E;
		E.Id = TEXT("gen_invader");
		E.Title = FString::Printf(TEXT("%s Falls From the Sky"), *Foe);
		E.Tag = TEXT("battle");
		E.Kind = TEXT("battle");
		E.Body = FString::Printf(
			TEXT("Over %s, %s. %s reads %s on every scanner and wants %s. %s's hands are already curling into fists."),
			*World.Name, Pick(Rng, Arrivals), *Foe, *FoePl, Pick(Rng, Demands), *Player.Name);
		E.Choices.Add(BattleChoice(Rng, FString::Printf(TEXT("Meet %s head-on"), *Foe),
			Mult > 1.3f ? TEXT("world_hunt") : TEXT("world_duel"), ERiftAttributeId::Might,
			FString::Printf(TEXT("%s answered %s's landing with fists — power sharpened under a real invader"), *Player.Name, *Foe),
			FString::Printf(TEXT("%s hit harder than the scanner promised — %s's body keeps the lesson"), *Foe, *Player.Name)));
		E.Choices.Add(SkillChoice(Rng, TEXT("Evacuate the district first"),
			TEXT("Presence DC — then the fight finds you"), ERiftAttributeId::Presence,
			FString::Printf(TEXT("%s moved a district out of the blast zone before trading a single blow"), *Player.Name),
			TEXT("The evacuation cost bruises and time — Endurance grew out of the scramble"),
			TEXT("world_skirmish")));
		E.Choices.Add(SkillChoice(Rng, FString::Printf(TEXT("Study %s's stance from cover"), *Foe),
			TEXT("Intellect DC — Defense/Force from reading the threat"), ERiftAttributeId::Intellect,
			FString::Printf(TEXT("%s mapped %s's form before it mapped them — Defense from patience"), *Player.Name, *Foe),
			FString::Printf(TEXT("%s spotted the tail — %s escaped with scraped Force channels and notes"), *Foe, *Player.Name)));
		return E;
	}

	static FRiftWorldEvent MakeTournament(const FRiftManagedWorld& World, const FRiftPlayerBuild& Player, int64 PL, FRandomStream& Rng)
	{
		static const TCHAR* Crowns[] = { TEXT("Ember"), TEXT("Hollow"), TEXT("Skyline"), TEXT("Iron"), TEXT("Pale") };
		const FString Crown = FString::Printf(TEXT("%s Crown"), Pick(Rng, Crowns));
		FRiftWorldEvent E;
		E.Id = TEXT("gen_tournament");
		E.Title = FString::Printf(TEXT("The %s Bracket"), *Crown);
		E.Tag = TEXT("battle");
		E.Kind = TEXT("battle");
		E.Body = FString::Printf(
			TEXT("%s chalks a ring and calls the %s: %s. %s is seeded at %s."),
			*World.Name, *Crown, Pick(Rng, Stakes), *Player.Name, *RiftPower::FormatPL(PL));
		E.Choices.Add(BattleChoice(Rng, TEXT("Enter the bracket"), TEXT("world_duel"), ERiftAttributeId::Agility,
			FString::Printf(TEXT("%s fought through the %s bracket — crowd-pressure carved the combos in deep"), *Player.Name, *Crown),
			FString::Printf(TEXT("Knocked out of the %s, %s kept the footwork the loss paid for"), *Crown, *Player.Name)));
		E.Choices.Add(SkillChoice(Rng, TEXT("Train until the opening bell"),
			TEXT("Grit DC — Strength/Endurance from a last hard camp"), ERiftAttributeId::Grit,
			FString::Printf(TEXT("%s burned the pre-bracket nights in a training camp that left dents in the floor"), *Player.Name),
			TEXT("Overtraining tweaked a shoulder — but the reps still counted")));
		E.Choices.Add(SkillChoice(Rng, TEXT("Scout the other seeds"),
			TEXT("Intellect DC — Defense/Resistance from reading the field"), ERiftAttributeId::Intellect,
			FString::Printf(TEXT("%s charted every seed's habits — Defense from homework nobody else did"), *Player.Name),
			TEXT("Half the notes were wrong, but the discipline of watching sharpened Resistance")));
		return E;
	}

	static FRiftWorldEvent MakeTraining(const FRiftManagedWorld& World, const FRiftPlayerBuild& Player, FRandomStream& Rng)
	{
		const FString Mentor = GenFoe(Rng);
		FRiftWorldEvent E;
		E.Id = TEXT("gen_training");
		E.Title = FString::Printf(TEXT("%s's Cruel Classroom"), *Mentor);
		E.Tag = TEXT("growth");
		E.Body = FString::Printf(
			TEXT("%s takes one look at %s on %s and points at %s. \"Quit whenever you like,\" they say, and don't smile."),
			*Mentor, *Player.Name, *World.Name, Pick(Rng, Trainings));
		E.Choices.Add(SkillChoice(Rng, TEXT("Take the full circuit"),
			TEXT("Grit DC — heavy Strength/Endurance"), ERiftAttributeId::Grit,
			FString::Printf(TEXT("%s finished %s's circuit — muscle rebuilt itself around the punishment"), *Player.Name, *Mentor),
			FString::Printf(TEXT("%s collapsed on the last leg — the failure still forged Endurance"), *Player.Name)));
		E.Choices.Add(SkillChoice(Rng, TEXT("Master one movement perfectly"),
			TEXT("Control DC — Speed/Force from precision"), ERiftAttributeId::Control,
			FString::Printf(TEXT("One movement, ten thousand times — %s's Speed stopped being a number"), *Player.Name),
			FString::Printf(TEXT("The movement never clicked, but the chase tuned %s's Force channels"), *Player.Name)));
		E.Choices.Add(BattleChoice(Rng, FString::Printf(TEXT("Ask %s to fight instead"), *Mentor),
			TEXT("world_duel"), ERiftAttributeId::Presence,
			FString::Printf(TEXT("%s said yes with their fists — %s learned at full contact"), *Mentor, *Player.Name),
			FString::Printf(TEXT("%s folded %s in three exchanges — every fold was a lesson"), *Mentor, *Player.Name)));
		return E;
	}

	static FRiftWorldEvent MakeRival(const FRiftManagedWorld& World, const FRiftPlayerBuild& Player, int64 PL, FRandomStream& Rng)
	{
		const FString Rival = GenFoe(Rng);
		const FString Jump = RiftPower::FormatPL(FMath::RoundToInt64(PL * (1.1f + Rng.FRand() * 0.6f)));
		FRiftWorldEvent E;
		E.Id = TEXT("gen_rival_return");
		E.Title = FString::Printf(TEXT("%s Came Back Wrong"), *Rival);
		E.Tag = TEXT("rivalry");
		E.Kind = TEXT("battle");
		E.Body = FString::Printf(
			TEXT("Last season %s left %s humiliated. They're back at %s — scanners double-take. They call %s out by name."),
			*Rival, *World.Name, *Jump, *Player.Name);
		E.Choices.Add(BattleChoice(Rng, TEXT("Answer the callout now"), TEXT("world_duel"), ERiftAttributeId::Might,
			FString::Printf(TEXT("%s met %s's comeback with open hands — rivalry is the fastest teacher"), *Player.Name, *Rival),
			FString::Printf(TEXT("%s's new power was real — %s ate the loss and grew around it"), *Rival, *Player.Name)));
		E.Choices.Add(SkillChoice(Rng, TEXT("Make them wait a day"),
			TEXT("Will DC — Resistance; fight on your terms"), ERiftAttributeId::Will,
			FString::Printf(TEXT("%s refused the ambush-duel and set the terms — composure is armor"), *Player.Name),
			TEXT("The crowd read it as fear — carrying that read still hardened Resistance"),
			TEXT("world_duel")));
		E.Choices.Add(SkillChoice(Rng, TEXT("Ask what they endured"),
			TEXT("Presence DC — their training becomes your map"), ERiftAttributeId::Presence,
			FString::Printf(TEXT("%s talked before fighting — their pain became %s's shortcut"), *Rival, *Player.Name),
			FString::Printf(TEXT("%s spat at the question — the rejection taught its own endurance"), *Rival)));
		return E;
	}

	static FRiftWorldEvent MakeRelic(const FRiftManagedWorld& World, const FRiftPlayerBuild& Player, FRandomStream& Rng)
	{
		const FString Relic = Pick(Rng, Relics);
		const int32 N = 3 + Rng.RandHelper(5);
		const FString RivalTeam = GenFoe(Rng);
		FRiftWorldEvent E;
		E.Id = TEXT("gen_relic");
		E.Title = FString::Printf(TEXT("%d %ss, One Map"), N, *Relic);
		E.Tag = TEXT("discovery");
		E.Body = FString::Printf(
			TEXT("A dying courier presses a map into %s's hands: %d %ss buried across %s. %s holds a copy of the same map."),
			*Player.Name, N, *Relic, *World.Name, *RivalTeam);
		E.Choices.Add(SkillChoice(Rng, TEXT("Race the map point to point"),
			TEXT("Agility DC — Speed; beat them to the caches"), ERiftAttributeId::Agility,
			FString::Printf(TEXT("%s out-ran %s across dig sites — Speed with a treasure receipt"), *Player.Name, *RivalTeam),
			FString::Printf(TEXT("%s got there first twice — chasing them still built Speed"), *RivalTeam)));
		E.Choices.Add(BattleChoice(Rng, TEXT("Ambush the rival dig team"), TEXT("world_skirmish"), ERiftAttributeId::Might,
			FString::Printf(TEXT("%s hit %s's dig team hard — the map and the bruises both stayed"), *Player.Name, *RivalTeam),
			FString::Printf(TEXT("%s fought dirty over a hole — %s kept the lesson"), *RivalTeam, *Player.Name)));
		E.Choices.Add(SkillChoice(Rng, TEXT("Decipher the courier's cipher first"),
			TEXT("Intellect DC — Force from reading dead ink"), ERiftAttributeId::Intellect,
			FString::Printf(TEXT("%s cracked the cipher — Force channels hummed with stolen coordinates"), *Player.Name),
			TEXT("The cipher burned half a day — stubbornness still trained Intellect into Force")));
		return E;
	}

	FRiftWorldEvent Generate(const FRiftManagedWorld& World, const FRiftPlayerBuild& Player, int64 PowerLevel, FRandomStream& Rng, bool bReboundSurge)
	{
		const int32 Roll = Rng.RandHelper(5);
		FRiftWorldEvent E;
		switch (Roll)
		{
		case 0: E = MakeInvader(World, Player, PowerLevel, Rng); break;
		case 1: E = MakeTournament(World, Player, PowerLevel, Rng); break;
		case 2: E = MakeTraining(World, Player, Rng); break;
		case 3: E = MakeRival(World, Player, PowerLevel, Rng); break;
		default: E = MakeRelic(World, Player, Rng); break;
		}
		if (bReboundSurge)
		{
			E.Title = TEXT("[Rebound Surge] ") + E.Title;
			E.Body = TEXT("After the last loss, something in your Pulse refuses to stay quiet. ") + E.Body;
		}
		return E;
	}
}
