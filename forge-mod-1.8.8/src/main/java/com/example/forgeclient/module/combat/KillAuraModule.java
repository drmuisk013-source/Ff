package com.example.forgeclient.module.combat;

import com.example.forgeclient.module.Category;
import com.example.forgeclient.module.Module;
import net.minecraft.entity.EntityLivingBase;
import net.minecraft.entity.player.EntityPlayer;
import net.minecraft.item.ItemStack;
import net.minecraft.item.ItemSword;
import net.minecraft.util.MathHelper;
import org.lwjgl.input.Keyboard;

import java.util.Comparator;
import java.util.List;
import java.util.Random;

public class KillAuraModule extends Module {
    private double range = 4.2;
    private long lastAttackTime = 0;
    private final Random random = new Random();

    public KillAuraModule() {
        super("KillAura", "Advanced KillAura with rotation smoothing and CPS jitter", Category.COMBAT, Keyboard.KEY_R);
    }

    @Override
    public void onTick() {
        if (mc.thePlayer == null || mc.theWorld == null) return;

        long now = System.currentTimeMillis();
        long delay = 65 + random.nextInt(40); // 10-15 CPS jittered
        if (now - lastAttackTime < delay) return;

        List<EntityLivingBase> targets = mc.theWorld.getEntities(EntityLivingBase.class, entity ->
            entity != mc.thePlayer &&
            entity.isEntityAlive() &&
            mc.thePlayer.getDistanceToEntity(entity) <= range &&
            !(entity instanceof EntityPlayer && ((EntityPlayer) entity).isSpectator())
        );

        targets.sort(Comparator.comparingDouble(e -> mc.thePlayer.getDistanceToEntity(e)));

        if (!targets.isEmpty()) {
            EntityLivingBase target = targets.get(0);

            // Rotation with smoothing and jitter bypass
            double dx = target.posX + (random.nextDouble() - 0.5) * 0.1 - mc.thePlayer.posX;
            double dy = target.posY + target.getEyeHeight() - (mc.thePlayer.posY + mc.thePlayer.getEyeHeight());
            double dz = target.posZ + (random.nextDouble() - 0.5) * 0.1 - mc.thePlayer.posZ;
            double dist = MathHelper.sqrt_double(dx * dx + dz * dz);

            float targetYaw = (float) (Math.atan2(dz, dx) * 180.0 / Math.PI) - 90.0f;
            float targetPitch = (float) (-(Math.atan2(dy, dist) * 180.0 / Math.PI));

            float yawDiff = MathHelper.wrapAngleTo180_float(targetYaw - mc.thePlayer.rotationYaw);
            float pitchDiff = MathHelper.wrapAngleTo180_float(targetPitch - mc.thePlayer.rotationPitch);

            // Smooth rotation clamp (max 45 deg/tick)
            mc.thePlayer.rotationYaw += MathHelper.clamp_float(yawDiff, -45.0f, 45.0f);
            mc.thePlayer.rotationPitch += MathHelper.clamp_float(pitchDiff, -25.0f, 25.0f);

            // Auto-block logic integration
            ItemStack held = mc.thePlayer.getHeldItem();
            if (held != null && held.getItem() instanceof ItemSword) {
                mc.playerController.sendUseItem(mc.thePlayer, mc.theWorld, held);
            }

            // Swing and attack
            mc.thePlayer.swingItem();
            mc.playerController.attackEntity(mc.thePlayer, target);
            lastAttackTime = now;
        }
    }
}
