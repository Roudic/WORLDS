#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "RiftwakePlayerController.generated.h"

UCLASS()
class RIFTWAKE_API ARiftwakePlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	ARiftwakePlayerController();
	virtual void BeginPlay() override;
	virtual void SetupInputComponent() override;

protected:
	void HandleDigit(int32 Digit);
	void HandleEnter();
	void HandleEscape();
	void HandleBackspace();
	void HandleCycleName();

	void OnKey1() { HandleDigit(1); }
	void OnKey2() { HandleDigit(2); }
	void OnKey3() { HandleDigit(3); }
	void OnKey4() { HandleDigit(4); }
	void OnKey5() { HandleDigit(5); }
	void OnKey6() { HandleDigit(6); }
	void OnKey7() { HandleDigit(7); }
	void OnKey8() { HandleDigit(8); }
	void OnKey9() { HandleDigit(9); }
	void OnKey0() { HandleDigit(0); }

	UPROPERTY()
	TObjectPtr<class URiftwakeGameInstance> RiftGI;

	int32 NamePresetIndex = 0;
};
