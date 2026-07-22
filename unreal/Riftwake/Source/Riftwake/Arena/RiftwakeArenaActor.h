#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "RiftwakeArenaActor.generated.h"

UCLASS()
class RIFTWAKE_API ARiftwakeArenaActor : public AActor
{
	GENERATED_BODY()

public:
	ARiftwakeArenaActor();
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	void SyncFromGame();

protected:
	UPROPERTY(VisibleAnywhere)
	TObjectPtr<USceneComponent> Root;

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<class UStaticMeshComponent> Ground;

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<class UStaticMeshComponent> PlayerMesh;

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<class UStaticMeshComponent> FoeMesh;

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<class UCameraComponent> ArenaCamera;

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<class UDirectionalLightComponent> Sun;

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<class USkyLightComponent> Sky;

	float PulseTime = 0.f;
	FVector PlayerBase = FVector(-180.f, 0.f, 90.f);
	FVector FoeBase = FVector(180.f, 0.f, 90.f);

	void ApplyEmissive(UStaticMeshComponent* Mesh, const FLinearColor& Color, float Strength);
};
