#include "CharacterRoster.h"

namespace RiftRoster
{
	FRiftPlayerBuild MakeDefaultBuild(const FString& Name)
	{
		FRiftPlayerBuild B;
		B.Name = Name.IsEmpty() ? TEXT("Wakeborn") : Name;
		B.Origin = TEXT("Crossfall");
		B.Discipline = TEXT("Pulse");
		B.Attributes = FRiftAttributes();
		B.Level = 1;
		B.Resolve = 2;
		B.Techniques = { TEXT("pulse_strike"), TEXT("guard_break"), TEXT("flux_bolt") };
		return B;
	}

	FRiftRosterCharacter CreateCharacter(const FRiftPlayerBuild& Build, FRandomStream& Rng)
	{
		FRiftRosterCharacter C;
		const int32 N = Rng.RandHelper(1000000000);
		C.Id = FString::Printf(TEXT("char_%x"), N);
		C.Build = Build;
		return C;
	}

	FRiftRosterCharacter* FindMutable(FRiftSaveGame& Save, const FString& CharacterId)
	{
		for (FRiftRosterCharacter& C : Save.Characters)
		{
			if (C.Id == CharacterId) return &C;
		}
		return nullptr;
	}

	const FRiftRosterCharacter* Find(const FRiftSaveGame& Save, const FString& CharacterId)
	{
		for (const FRiftRosterCharacter& C : Save.Characters)
		{
			if (C.Id == CharacterId) return &C;
		}
		return nullptr;
	}

	FRiftRosterCharacter* ActiveMutable(FRiftSaveGame& Save)
	{
		if (Save.Characters.Num() == 0) return nullptr;
		if (FRiftRosterCharacter* Found = FindMutable(Save, Save.ActiveCharacterId))
		{
			return Found;
		}
		Save.ActiveCharacterId = Save.Characters[0].Id;
		return &Save.Characters[0];
	}

	const FRiftRosterCharacter* Active(const FRiftSaveGame& Save)
	{
		if (Save.Characters.Num() == 0) return nullptr;
		if (const FRiftRosterCharacter* Found = Find(Save, Save.ActiveCharacterId))
		{
			return Found;
		}
		return &Save.Characters[0];
	}

	bool SelectCharacter(FRiftSaveGame& Save, const FString& CharacterId)
	{
		const FRiftRosterCharacter* C = Find(Save, CharacterId);
		if (!C) return false;
		Save.ActiveCharacterId = C->Id;
		if (!C->WorldId.IsEmpty())
		{
			Save.ActiveWorldId = C->WorldId;
		}
		return true;
	}

	bool PlaceCharacter(FRiftSaveGame& Save, const FString& CharacterId, const FString& WorldId)
	{
		FRiftRosterCharacter* C = FindMutable(Save, CharacterId);
		if (!C) return false;
		if (!WorldId.IsEmpty())
		{
			bool bFound = false;
			for (const FRiftManagedWorld& W : Save.Worlds)
			{
				if (W.Id == WorldId) { bFound = true; break; }
			}
			if (!bFound) return false;
		}
		C->WorldId = WorldId;
		if (!WorldId.IsEmpty())
		{
			Save.ActiveWorldId = WorldId;
		}
		return true;
	}

	TArray<FRiftRosterCharacter> CharactersOnWorld(const FRiftSaveGame& Save, const FString& WorldId)
	{
		TArray<FRiftRosterCharacter> Out;
		for (const FRiftRosterCharacter& C : Save.Characters)
		{
			if (C.WorldId == WorldId) Out.Add(C);
		}
		return Out;
	}
}
