package com.example.forgeclient.event;

import com.example.forgeclient.ForgeClientMod;
import com.example.forgeclient.proxy.ClientProxy;
import net.minecraft.client.Minecraft;
import net.minecraft.util.ChatComponentText;
import net.minecraft.util.EnumChatFormatting;
import net.minecraftforge.client.event.RenderWorldLastEvent;
import net.minecraftforge.fml.common.eventhandler.SubscribeEvent;
import net.minecraftforge.fml.common.gameevent.InputEvent;
import net.minecraftforge.fml.common.gameevent.TickEvent;
import org.lwjgl.input.Keyboard;

public class ClientEventHandler {
    @SubscribeEvent
    public void onKeyInput(InputEvent.KeyInputEvent event) {
        if (Keyboard.getEventKeyState()) {
            int key = Keyboard.getEventKey();
            if (ForgeClientMod.moduleManager != null) {
                ForgeClientMod.moduleManager.onKey(key);
            }
        }
    }

    @SubscribeEvent
    public void onClientTick(TickEvent.ClientTickEvent event) {
        if (event.phase == TickEvent.Phase.END) {
            if (ForgeClientMod.moduleManager != null) {
                ForgeClientMod.moduleManager.onTick();
            }
        }
    }

    @SubscribeEvent
    public void onRenderWorldLast(RenderWorldLastEvent event) {
        if (ForgeClientMod.moduleManager != null) {
            ForgeClientMod.moduleManager.onRender3D(event.partialTicks);
        }
    }
}
