#include "RiftwakeHUD.h"
#include "RiftwakeGameInstance.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"

void ARiftwakeHUD::DrawHUD()
{
	Super::DrawHUD();

	URiftwakeGameInstance* GI = Cast<URiftwakeGameInstance>(GetGameInstance());
	if (!GI || !Canvas) return;

	const FString Text = GI->BuildHudText();

	// Soft atmospheric panel over the procedural arena
	DrawRect(FLinearColor(0.02f, 0.04f, 0.07f, 0.72f), 24.f, 24.f, Canvas->ClipX * 0.52f, Canvas->ClipY - 48.f);

	float XL = 0.f, YL = 0.f;
	UFont* Font = GEngine ? GEngine->GetSmallFont() : nullptr;
	if (!Font && GEngine) Font = GEngine->GetMediumFont();

	const float X = 40.f;
	float Y = 40.f;
	TArray<FString> Lines;
	Text.ParseIntoArrayLines(Lines, false);
	for (const FString& Line : Lines)
	{
		FLinearColor Color = FLinearColor(0.85f, 0.92f, 1.f, 1.f);
		if (Line.StartsWith(TEXT("═")) || Line.Contains(TEXT("RIFTWAKE")))
		{
			Color = FLinearColor(1.f, 0.78f, 0.35f, 1.f);
		}
		else if (Line.StartsWith(TEXT("[")))
		{
			Color = FLinearColor(0.55f, 0.95f, 0.75f, 1.f);
		}
		else if (Line.Contains(TEXT("COMBAT")) || Line.Contains(TEXT("Victory")) || Line.Contains(TEXT("Defeat")))
		{
			Color = FLinearColor(1.f, 0.55f, 0.45f, 1.f);
		}

		if (Font)
		{
			GetTextSize(Line, XL, YL, Font, 1.05f);
			DrawText(Line, Color, X, Y, Font, 1.05f, false);
			Y += YL + 2.f;
		}
		else
		{
			DrawText(Line, Color, X, Y);
			Y += 16.f;
		}
	}
}
