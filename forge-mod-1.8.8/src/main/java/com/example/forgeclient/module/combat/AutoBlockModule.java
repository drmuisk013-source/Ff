package com.example.forgeclient.module.combat;

import com.example.forgeclient.module.Category;
import com.example.forgeclient.module.Module;
import net.minecraft.entity.EntityLivingBase;
import net.minecraft.item.ItemStack;
import net.minecraft.item.ItemSword;
import org.lwjgl.input.Keyboard;

import java.util.List;

public class AutoBlockModule extends Module {
    private double range = 4.5;

    public AutoBlockModule() {
        super("AutoBlock", "Automatically blocks with sword during combat", Category.COMBAT, Keyboard.KEY_B);
    }

    @Override
    public void onTick() {
        if (mc.thePlayer == null || mc.theWorld == null) return;

        ItemStack heldItem = mc.thePlayer.getHeldItem();
        if (heldItem == null || !(heldItem.getItem() instanceof ItemSword)) return;

        List<EntityLivingBase> targets = mc.theWorld.getEntities(EntityLivingBase.class, entity ->
            entity != mc.thePlayer &&
            entity.isEntityAlive() &&
            mc.thePlayer.getDistanceToEntity(entity) <= range
        );

        if (!targets.isEmpty() && !mc.thePlayer.isUsingItem()) {
            mc.playerController.sendUseItem(mc.thePlayer, mc.theWorld, heldItem);
        }
    }
}
