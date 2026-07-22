#pragma once

#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "Core/RiftwakeTypes.h"
#include "RiftwakeGameInstance.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnRiftwakeStateChanged);

UCLASS()
class RIFTWAKE_API URiftwakeGameInstance : public UGameInstance
{
	GENERATED_BODY()

public:
	virtual void Init() override;

	UPROPERTY(BlueprintReadOnly, Category = "Riftwake")
	FRiftSaveGame Save;

	UPROPERTY(BlueprintReadOnly, Category = "Riftwake")
	ERiftGameScreen Screen = ERiftGameScreen::Title;

	UPROPERTY(BlueprintReadOnly, Category = "Riftwake")
	FRiftCombatState Combat;

	UPROPERTY(BlueprintReadOnly, Category = "Riftwake")
	FString StatusLine;

	UPROPERTY(BlueprintReadOnly, Category = "Riftwake")
	FString CreateNameDraft = TEXT("Wakeborn");

	UPROPERTY(BlueprintAssignable, Category = "Riftwake")
	FOnRiftwakeStateChanged OnStateChanged;

	FRandomStream& Rng() { return Stream; }

	UFUNCTION(BlueprintCallable, Category = "Riftwake")
	void NotifyChanged();

	UFUNCTION(BlueprintCallable, Category = "Riftwake")
	void GoTitle();

	UFUNCTION(BlueprintCallable, Category = "Riftwake")
	void GoCreate();

	UFUNCTION(BlueprintCallable, Category = "Riftwake")
	void ConfirmCreate();

	UFUNCTION(BlueprintCallable, Category = "Riftwake")
	void GoHub();

	UFUNCTION(BlueprintCallable, Category = "Riftwake")
	void CreateStarterWorld(ERiftWorldTone Tone);

	UFUNCTION(BlueprintCallable, Category = "Riftwake")
	void PlaceActiveOnWorld();

	UFUNCTION(BlueprintCallable, Category = "Riftwake")
	void RollEvent();

	UFUNCTION(BlueprintCallable, Category = "Riftwake")
	void ResolveChoice(int32 ChoiceIndex);

	UFUNCTION(BlueprintCallable, Category = "Riftwake")
	void CombatAction(const FString& ActionId);

	UFUNCTION(BlueprintCallable, Category = "Riftwake")
	void FinishCombatToHub();

	UFUNCTION(BlueprintCallable, Category = "Riftwake")
	void TrainActive(ERiftBattleStat Stat);

	UFUNCTION(BlueprintCallable, Category = "Riftwake")
	void RaiseActiveWorldCeiling();

	UFUNCTION(BlueprintCallable, Category = "Riftwake")
	FString BuildHudText() const;

	const FRiftManagedWorld* ActiveWorld() const;
	FRiftManagedWorld* ActiveWorldMutable();

private:
	FRandomStream Stream;
	void EnsureBootstrap();
	void ApplyTrainingLean(FRiftRosterCharacter& Char, const TArray<FString>& Lean, bool bSuccess);
};
