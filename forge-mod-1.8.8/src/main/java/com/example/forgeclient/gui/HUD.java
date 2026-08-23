package com.example.forgeclient.gui;

import com.example.forgeclient.ForgeClientMod;
import com.example.forgeclient.module.Module;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.FontRenderer;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.ScaledResolution;
import net.minecraft.util.EnumChatFormatting;
import net.minecraftforge.client.event.RenderGameOverlayEvent;
import net.minecraftforge.fml.common.eventhandler.SubscribeEvent;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

public class HUD {
    private final Minecraft mc = Minecraft.getMinecraft();

    @SubscribeEvent
    public void onRenderOverlay(RenderGameOverlayEvent.Post event) {
        if (event.type != RenderGameOverlayEvent.ElementType.TEXT) return;
        if (mc.thePlayer == null || mc.theWorld == null || mc.gameSettings.showDebugInfo) return;

        FontRenderer font = mc.fontRendererObj;
        ScaledResolution sr = new ScaledResolution(mc);

        // Watermark
        String title = EnumChatFormatting.DARK_PURPLE + "ForgeClient " + EnumChatFormatting.GRAY + "v1.1";
        font.drawStringWithShadow(title, 4, 4, 0xFFFFFF);

        // Active modules list (ArrayList)
        if (ForgeClientMod.moduleManager != null) {
            List<Module> active = ForgeClientMod.moduleManager.getModules().stream()
                .filter(Module::isEnabled)
                .sorted(Comparator.comparingInt((Module m) -> font.getStringWidth(m.getName())).reversed())
                .collect(Collectors.toList());

            int y = 4;
            for (Module m : active) {
                String name = m.getName();
                int x = sr.getScaledWidth() - font.getStringWidth(name) - 4;
                font.drawStringWithShadow(EnumChatFormatting.LIGHT_PURPLE + name, x, y, 0xFFFFFF);
                y += font.FONT_HEIGHT + 2;
            }
        }
    }
}
