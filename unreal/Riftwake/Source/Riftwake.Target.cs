using UnrealBuildTool;

public class RiftwakeTarget : TargetRules
{
	public RiftwakeTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;
		ExtraModuleNames.Add("Riftwake");
	}
}
