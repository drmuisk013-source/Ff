package com.example.forgeclient.module.combat;

import com.example.forgeclient.module.Category;
import com.example.forgeclient.module.Module;
import net.minecraft.entity.EntityLivingBase;
import net.minecraft.entity.player.EntityPlayer;
import org.lwjgl.input.Keyboard;

import java.util.Comparator;
import java.util.List;

public class AimAssistModule extends Module {
    private double range = 5.0;
    private float speed = 4.5f;

    public AimAssistModule() {
        super("AimAssist", "Smoothly assists crosshair aiming toward targets", Category.COMBAT, Keyboard.KEY_G);
    }

    @Override
    public void onTick() {
        if (mc.thePlayer == null || mc.theWorld == null) return;
        if (mc.currentScreen != null) return;

        List<EntityLivingBase> targets = mc.theWorld.getEntities(EntityLivingBase.class, entity ->
            entity != mc.thePlayer &&
            entity.isEntityAlive() &&
            mc.thePlayer.getDistanceToEntity(entity) <= range &&
            !(entity instanceof EntityPlayer && ((EntityPlayer) entity).isSpectator())
        );

        targets.sort(Comparator.comparingDouble(e -> mc.thePlayer.getDistanceToEntity(e)));

        if (!targets.isEmpty()) {
            EntityLivingBase target = targets.get(0);
            double dx = target.posX - mc.thePlayer.posX;
            double dy = target.posY + target.getEyeHeight() - (mc.thePlayer.posY + mc.thePlayer.getEyeHeight());
            double dz = target.posZ - mc.thePlayer.posZ;
            double dist = Math.sqrt(dx * dx + dz * dz);

            float targetYaw = (float) (Math.atan2(dz, dx) * 180.0 / Math.PI) - 90.0f;
            float targetPitch = (float) (-(Math.atan2(dy, dist) * 180.0 / Math.PI));

            float yawDiff = wrapAngleTo180(targetYaw - mc.thePlayer.rotationYaw);
            float pitchDiff = wrapAngleTo180(targetPitch - mc.thePlayer.rotationPitch);

            if (Math.abs(yawDiff) < 60.0f) {
                mc.thePlayer.rotationYaw += yawDiff / (10.0f - speed);
                mc.thePlayer.rotationPitch += pitchDiff / (10.0f - speed);
            }
        }
    }

    private float wrapAngleTo180(float angle) {
        angle %= 360.0f;
        if (angle >= 180.0f) angle -= 360.0f;
        if (angle < -180.0f) angle += 360.0f;
        return angle;
    }
}
