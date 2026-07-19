#include "RiftwakeGameMode.h"
#include "RiftwakePlayerController.h"
#include "RiftwakeHUD.h"
#include "Arena/RiftwakeArenaActor.h"
#include "GameFramework/SpectatorPawn.h"

ARiftwakeGameMode::ARiftwakeGameMode()
{
	PlayerControllerClass = ARiftwakePlayerController::StaticClass();
	HUDClass = ARiftwakeHUD::StaticClass();
	DefaultPawnClass = ASpectatorPawn::StaticClass();
}

void ARiftwakeGameMode::BeginPlay()
{
	Super::BeginPlay();

	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	Arena = GetWorld()->SpawnActor<ARiftwakeArenaActor>(ARiftwakeArenaActor::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator, Params);

	if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
	{
		PC->bShowMouseCursor = true;
		FInputModeGameAndUI Mode;
		Mode.SetHideCursorDuringCapture(false);
		PC->SetInputMode(Mode);

		// Position a free camera overlooking the procedural arena
		if (APawn* Viewer = PC->GetPawn())
		{
			Viewer->SetActorLocation(FVector(0.f, -900.f, 420.f));
			Viewer->SetActorRotation(FRotator(-18.f, 90.f, 0.f));
		}
		else
		{
			PC->SetViewTarget(Arena);
		}
	}
}
