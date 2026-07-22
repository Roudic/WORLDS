#include "RiftwakePlayerController.h"
#include "RiftwakeGameInstance.h"
#include "Core/CharacterRoster.h"
#include "Core/CombatSystem.h"
#include "Core/WorldSystem.h"
#include "Components/InputComponent.h"

ARiftwakePlayerController::ARiftwakePlayerController()
{
	bShowMouseCursor = true;
}

void ARiftwakePlayerController::BeginPlay()
{
	Super::BeginPlay();
	RiftGI = Cast<URiftwakeGameInstance>(GetGameInstance());
}

void ARiftwakePlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();
	if (!InputComponent) return;

	InputComponent->BindKey(EKeys::Enter, IE_Pressed, this, &ARiftwakePlayerController::HandleEnter);
	InputComponent->BindKey(EKeys::Escape, IE_Pressed, this, &ARiftwakePlayerController::HandleEscape);
	InputComponent->BindKey(EKeys::BackSpace, IE_Pressed, this, &ARiftwakePlayerController::HandleBackspace);
	InputComponent->BindKey(EKeys::Tab, IE_Pressed, this, &ARiftwakePlayerController::HandleCycleName);

	InputComponent->BindKey(EKeys::One, IE_Pressed, this, &ARiftwakePlayerController::OnKey1);
	InputComponent->BindKey(EKeys::Two, IE_Pressed, this, &ARiftwakePlayerController::OnKey2);
	InputComponent->BindKey(EKeys::Three, IE_Pressed, this, &ARiftwakePlayerController::OnKey3);
	InputComponent->BindKey(EKeys::Four, IE_Pressed, this, &ARiftwakePlayerController::OnKey4);
	InputComponent->BindKey(EKeys::Five, IE_Pressed, this, &ARiftwakePlayerController::OnKey5);
	InputComponent->BindKey(EKeys::Six, IE_Pressed, this, &ARiftwakePlayerController::OnKey6);
	InputComponent->BindKey(EKeys::Seven, IE_Pressed, this, &ARiftwakePlayerController::OnKey7);
	InputComponent->BindKey(EKeys::Eight, IE_Pressed, this, &ARiftwakePlayerController::OnKey8);
	InputComponent->BindKey(EKeys::Nine, IE_Pressed, this, &ARiftwakePlayerController::OnKey9);
	InputComponent->BindKey(EKeys::Zero, IE_Pressed, this, &ARiftwakePlayerController::OnKey0);

	InputComponent->BindKey(EKeys::NumPadOne, IE_Pressed, this, &ARiftwakePlayerController::OnKey1);
	InputComponent->BindKey(EKeys::NumPadTwo, IE_Pressed, this, &ARiftwakePlayerController::OnKey2);
	InputComponent->BindKey(EKeys::NumPadThree, IE_Pressed, this, &ARiftwakePlayerController::OnKey3);
	InputComponent->BindKey(EKeys::NumPadFour, IE_Pressed, this, &ARiftwakePlayerController::OnKey4);
	InputComponent->BindKey(EKeys::NumPadFive, IE_Pressed, this, &ARiftwakePlayerController::OnKey5);
	InputComponent->BindKey(EKeys::NumPadSix, IE_Pressed, this, &ARiftwakePlayerController::OnKey6);
	InputComponent->BindKey(EKeys::NumPadSeven, IE_Pressed, this, &ARiftwakePlayerController::OnKey7);
	InputComponent->BindKey(EKeys::NumPadEight, IE_Pressed, this, &ARiftwakePlayerController::OnKey8);
	InputComponent->BindKey(EKeys::NumPadNine, IE_Pressed, this, &ARiftwakePlayerController::OnKey9);
}

void ARiftwakePlayerController::HandleCycleName()
{
	if (!RiftGI || RiftGI->Screen != ERiftGameScreen::Create) return;
	static const TCHAR* Presets[] = {
		TEXT("Wakeborn"), TEXT("Ashveil"), TEXT("Kaelith"), TEXT("Veyra"), TEXT("Torren"), TEXT("Nyxil")
	};
	NamePresetIndex = (NamePresetIndex + 1) % UE_ARRAY_COUNT(Presets);
	RiftGI->CreateNameDraft = Presets[NamePresetIndex];
	RiftGI->NotifyChanged();
}

void ARiftwakePlayerController::HandleEnter()
{
	if (!RiftGI) return;
	switch (RiftGI->Screen)
	{
	case ERiftGameScreen::Title:
		RiftGI->GoCreate();
		break;
	case ERiftGameScreen::Create:
		RiftGI->ConfirmCreate();
		break;
	default:
		break;
	}
}

void ARiftwakePlayerController::HandleEscape()
{
	if (!RiftGI) return;
	if (RiftGI->Screen == ERiftGameScreen::Event)
	{
		RiftGI->GoHub();
		return;
	}
	if (RiftGI->Screen == ERiftGameScreen::Title)
	{
		ConsoleCommand(TEXT("quit"));
	}
}

void ARiftwakePlayerController::HandleBackspace()
{
	if (!RiftGI) return;
	if (RiftGI->Screen == ERiftGameScreen::Create && RiftGI->CreateNameDraft.Len() > 0)
	{
		RiftGI->CreateNameDraft.LeftInline(RiftGI->CreateNameDraft.Len() - 1);
		RiftGI->NotifyChanged();
	}
}

void ARiftwakePlayerController::HandleDigit(int32 Digit)
{
	if (!RiftGI) return;

	if (RiftGI->Screen == ERiftGameScreen::Hub)
	{
		switch (Digit)
		{
		case 1: RiftGI->RollEvent(); break;
		case 2: RiftGI->TrainActive(ERiftBattleStat::Strength); break;
		case 3: RiftGI->TrainActive(ERiftBattleStat::Endurance); break;
		case 4: RiftGI->TrainActive(ERiftBattleStat::Speed); break;
		case 5: RiftGI->RaiseActiveWorldCeiling(); break;
		case 6: RiftGI->CreateStarterWorld(ERiftWorldTone::War); RiftGI->PlaceActiveOnWorld(); break;
		case 7: RiftGI->CreateStarterWorld(ERiftWorldTone::Ascension); RiftGI->PlaceActiveOnWorld(); break;
		case 8:
		{
			if (const FRiftRosterCharacter* C = RiftRoster::Active(RiftGI->Save))
			{
				RiftGI->Combat = RiftCombat::StartEncounter(TEXT("world_duel"), C->Build, RiftGI->Rng());
				RiftGI->Save.PendingReasonWin = TEXT("Sandbox duel won — fists write the log.");
				RiftGI->Save.PendingReasonLose = TEXT("Sandbox duel lost — Rebound Surge armed.");
				RiftGI->Screen = ERiftGameScreen::Combat;
				RiftGI->NotifyChanged();
			}
			break;
		}
		case 9:
		{
			FRiftPlayerBuild Build = RiftRoster::MakeDefaultBuild(FString::Printf(TEXT("Rival-%d"), RiftGI->Save.Characters.Num() + 1));
			Build.Attributes.Might += 1;
			FRiftRosterCharacter Extra = RiftRoster::CreateCharacter(Build, RiftGI->Rng());
			if (RiftGI->Save.Worlds.Num())
			{
				Extra.WorldId = RiftGI->Save.ActiveWorldId;
			}
			RiftGI->Save.Characters.Add(Extra);
			RiftGI->StatusLine = FString::Printf(TEXT("Added %s to the roster."), *Extra.Build.Name);
			RiftGI->NotifyChanged();
			break;
		}
		default: break;
		}
		return;
	}

	if (RiftGI->Screen == ERiftGameScreen::Event)
	{
		if (Digit >= 1 && Digit <= 3)
		{
			RiftGI->ResolveChoice(Digit - 1);
		}
		return;
	}

	if (RiftGI->Screen == ERiftGameScreen::Combat)
	{
		switch (Digit)
		{
		case 1: RiftGI->CombatAction(TEXT("strike")); break;
		case 2: RiftGI->CombatAction(TEXT("rush")); break;
		case 3: RiftGI->CombatAction(TEXT("bolt")); break;
		case 4: RiftGI->CombatAction(TEXT("powerup")); break;
		case 5: RiftGI->CombatAction(TEXT("guard")); break;
		case 6: RiftGI->CombatAction(TEXT("ascend")); break;
		default: break;
		}
	}
}
