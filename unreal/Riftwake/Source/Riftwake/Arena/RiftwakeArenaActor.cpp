#include "RiftwakeArenaActor.h"
#include "Game/RiftwakeGameInstance.h"
#include "Camera/CameraComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

ARiftwakeArenaActor::ARiftwakeArenaActor()
{
	PrimaryActorTick.bCanEverTick = true;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	Ground = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Ground"));
	Ground->SetupAttachment(Root);
	Ground->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	PlayerMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PlayerMesh"));
	PlayerMesh->SetupAttachment(Root);
	PlayerMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	FoeMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("FoeMesh"));
	FoeMesh->SetupAttachment(Root);
	FoeMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	ArenaCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("ArenaCamera"));
	ArenaCamera->SetupAttachment(Root);
	ArenaCamera->SetRelativeLocation(FVector(0.f, -1100.f, 520.f));
	ArenaCamera->SetRelativeRotation(FRotator(-20.f, 90.f, 0.f));
	ArenaCamera->SetFieldOfView(70.f);

	Sun = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("Sun"));
	Sun->SetupAttachment(Root);
	Sun->SetRelativeRotation(FRotator(-35.f, 40.f, 0.f));
	Sun->SetIntensity(8.f);
	Sun->SetLightColor(FLinearColor(1.f, 0.72f, 0.45f));

	Sky = CreateDefaultSubobject<USkyLightComponent>(TEXT("Sky"));
	Sky->SetupAttachment(Root);
	Sky->SetIntensity(1.2f);

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	if (CubeMesh.Succeeded())
	{
		Ground->SetStaticMesh(CubeMesh.Object);
		Ground->SetWorldScale3D(FVector(12.f, 12.f, 0.2f));
		Ground->SetRelativeLocation(FVector(0.f, 0.f, -20.f));
	}
	if (SphereMesh.Succeeded())
	{
		PlayerMesh->SetStaticMesh(SphereMesh.Object);
		FoeMesh->SetStaticMesh(SphereMesh.Object);
		PlayerMesh->SetWorldScale3D(FVector(1.4f));
		FoeMesh->SetWorldScale3D(FVector(1.5f));
		PlayerMesh->SetRelativeLocation(PlayerBase);
		FoeMesh->SetRelativeLocation(FoeBase);
	}
}

void ARiftwakeArenaActor::BeginPlay()
{
	Super::BeginPlay();
	ApplyEmissive(PlayerMesh, FLinearColor(0.25f, 0.75f, 1.f), 8.f);
	ApplyEmissive(FoeMesh, FLinearColor(1.f, 0.35f, 0.2f), 8.f);
	ApplyEmissive(Ground, FLinearColor(0.08f, 0.1f, 0.14f), 0.5f);

	if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
	{
		PC->SetViewTargetWithBlend(this, 0.f);
	}
	SyncFromGame();
}

void ARiftwakeArenaActor::ApplyEmissive(UStaticMeshComponent* Mesh, const FLinearColor& Color, float Strength)
{
	if (!Mesh) return;
	UMaterialInstanceDynamic* Dyn = Mesh->CreateAndSetMaterialInstanceDynamic(0);
	if (!Dyn) return;
	Dyn->SetVectorParameterValue(TEXT("Color"), Color);
	Dyn->SetVectorParameterValue(TEXT("BaseColor"), Color);
	Dyn->SetScalarParameterValue(TEXT("EmissiveStrength"), Strength);
	// Fallback tint via custom primitive data / overlay when engine material lacks params
	Mesh->SetVectorParameterValueOnMaterials(TEXT("Color"), FVector(Color));
}

void ARiftwakeArenaActor::SyncFromGame()
{
	URiftwakeGameInstance* GI = Cast<URiftwakeGameInstance>(GetGameInstance());
	if (!GI) return;

	const bool bCombat = GI->Screen == ERiftGameScreen::Combat;
	PlayerMesh->SetVisibility(true);
	FoeMesh->SetVisibility(bCombat || GI->Screen == ERiftGameScreen::Hub);

	if (bCombat && GI->Combat.Combatants.Num() >= 2)
	{
		const float PlayerPct = GI->Combat.Combatants[0].MaxVitality > 0
			? static_cast<float>(GI->Combat.Combatants[0].Vitality) / GI->Combat.Combatants[0].MaxVitality
			: 1.f;
		const float FoePct = GI->Combat.Combatants[1].MaxVitality > 0
			? static_cast<float>(GI->Combat.Combatants[1].Vitality) / GI->Combat.Combatants[1].MaxVitality
			: 1.f;
		PlayerMesh->SetWorldScale3D(FVector(1.1f + PlayerPct * 0.5f));
		FoeMesh->SetWorldScale3D(FVector(1.1f + FoePct * 0.6f));
		ApplyEmissive(PlayerMesh, GI->Combat.Combatants[0].bAscended
			? FLinearColor(1.f, 0.9f, 0.35f)
			: FLinearColor(0.25f, 0.75f, 1.f), 10.f + PlayerPct * 6.f);
		ApplyEmissive(FoeMesh, GI->Combat.Combatants[1].bAscended
			? FLinearColor(1.f, 0.2f, 0.55f)
			: FLinearColor(1.f, 0.35f, 0.2f), 10.f + FoePct * 6.f);
	}
}

void ARiftwakeArenaActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	PulseTime += DeltaSeconds;
	const float Bob = FMath::Sin(PulseTime * 2.4f) * 12.f;
	const float Bob2 = FMath::Sin(PulseTime * 2.4f + 1.2f) * 12.f;
	PlayerMesh->SetRelativeLocation(PlayerBase + FVector(0.f, 0.f, Bob));
	FoeMesh->SetRelativeLocation(FoeBase + FVector(0.f, 0.f, Bob2));

	URiftwakeGameInstance* GI = Cast<URiftwakeGameInstance>(GetGameInstance());
	if (GI && GI->Screen == ERiftGameScreen::Combat)
	{
		const float Punch = 1.f + 0.04f * FMath::Sin(PulseTime * 18.f);
		ArenaCamera->SetFieldOfView(68.f * Punch);
	}
	else
	{
		ArenaCamera->SetFieldOfView(70.f);
	}

	SyncFromGame();
}
