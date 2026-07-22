#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "RiftwakeHUD.generated.h"

UCLASS()
class RIFTWAKE_API ARiftwakeHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;

protected:
	UPROPERTY()
	TObjectPtr<class UFont> HudFont;
};
