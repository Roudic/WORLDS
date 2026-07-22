#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "RiftwakeGameMode.generated.h"

UCLASS()
class RIFTWAKE_API ARiftwakeGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ARiftwakeGameMode();

	virtual void BeginPlay() override;

protected:
	UPROPERTY()
	TObjectPtr<class ARiftwakeArenaActor> Arena;
};
