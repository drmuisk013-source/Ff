package com.example.forgeclient.module.movement;

import com.example.forgeclient.module.Category;
import com.example.forgeclient.module.Module;
import net.minecraft.block.BlockAir;
import net.minecraft.item.ItemBlock;
import net.minecraft.item.ItemStack;
import net.minecraft.util.BlockPos;
import net.minecraft.util.EnumFacing;
import net.minecraft.util.Vec3;
import org.lwjgl.input.Keyboard;

public class ScaffoldModule extends Module {
    public ScaffoldModule() {
        super("Scaffold", "Automatically places blocks beneath player feet", Category.MOVEMENT, Keyboard.KEY_G);
    }

    @Override
    public void onTick() {
        if (mc.thePlayer == null || mc.theWorld == null) return;

        BlockPos underPlayer = new BlockPos(mc.thePlayer.posX, mc.thePlayer.posY - 1.0, mc.thePlayer.posZ);

        if (mc.theWorld.getBlockState(underPlayer).getBlock() instanceof BlockAir) {
            int slot = getBlockSlot();
            if (slot == -1) return;

            int prevSlot = mc.thePlayer.inventory.currentItem;
            mc.thePlayer.inventory.currentItem = slot;

            mc.thePlayer.rotationPitch = 82.0f;

            EnumFacing facing = EnumFacing.UP;
            BlockPos targetPos = underPlayer.down();
            if (!(mc.theWorld.getBlockState(targetPos).getBlock() instanceof BlockAir)) {
                Vec3 hitVec = new Vec3(targetPos.getX() + 0.5, targetPos.getY() + 0.5, targetPos.getZ() + 0.5);
                mc.playerController.onPlayerRightClick(mc.thePlayer, mc.theWorld, mc.thePlayer.getHeldItem(), targetPos, facing, hitVec);
                mc.thePlayer.swingItem();
            }

            mc.thePlayer.inventory.currentItem = prevSlot;
        }
    }

    private int getBlockSlot() {
        for (int i = 0; i < 9; i++) {
            ItemStack stack = mc.thePlayer.inventory.getStackInSlot(i);
            if (stack != null && stack.getItem() instanceof ItemBlock) {
                return i;
            }
        }
        return -1;
    }
}
