package com.example.forgeclient.module.combat;

import com.example.forgeclient.module.Category;
import com.example.forgeclient.module.Module;
import net.minecraft.entity.EntityLivingBase;
import net.minecraft.entity.player.EntityPlayer;
import org.lwjgl.input.Keyboard;

import java.util.Comparator;
import java.util.List;

public class KillAuraModule extends Module {
    private double range = 4.2;
    private long lastAttackTime = 0;
    private long attackDelayMs = 75; // ~13 CPS

    public KillAuraModule() {
        super("KillAura", "Automatically attacks nearby targets within range", Category.COMBAT, Keyboard.KEY_R);
    }

    @Override
    public void onTick() {
        if (mc.thePlayer == null || mc.theWorld == null) return;

        long now = System.currentTimeMillis();
        if (now - lastAttackTime < attackDelayMs) return;

        List<EntityLivingBase> targets = mc.theWorld.getEntities(EntityLivingBase.class, entity ->
            entity != mc.thePlayer &&
            entity.isEntityAlive() &&
            mc.thePlayer.getDistanceToEntity(entity) <= range &&
            !(entity instanceof EntityPlayer && ((EntityPlayer) entity).isSpectator())
        );

        targets.sort(Comparator.comparingDouble(e -> mc.thePlayer.getDistanceToEntity(e)));

        if (!targets.isEmpty()) {
            EntityLivingBase target = targets.get(0);

            // Face target
            double dx = target.posX - mc.thePlayer.posX;
            double dy = target.posY + target.getEyeHeight() - (mc.thePlayer.posY + mc.thePlayer.getEyeHeight());
            double dz = target.posZ - mc.thePlayer.posZ;
            double dist = Math.sqrt(dx * dx + dz * dz);
            float yaw = (float) (Math.atan2(dz, dx) * 180.0 / Math.PI) - 90.0f;
            float pitch = (float) (-(Math.atan2(dy, dist) * 180.0 / Math.PI));

            mc.thePlayer.rotationYaw = yaw;
            mc.thePlayer.rotationPitch = pitch;

            // Swing and attack
            mc.thePlayer.swingItem();
            mc.playerController.attackEntity(mc.thePlayer, target);
            lastAttackTime = now;
        }
    }
}
