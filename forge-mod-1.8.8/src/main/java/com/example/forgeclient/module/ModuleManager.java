package com.example.forgeclient.module;

import com.example.forgeclient.module.combat.AimAssistModule;
import com.example.forgeclient.module.combat.AutoBlockModule;
import com.example.forgeclient.module.combat.KillAuraModule;
import com.example.forgeclient.module.movement.ScaffoldModule;
import com.example.forgeclient.module.render.ESPModule;

import java.util.ArrayList;
import java.util.List;

public class ModuleManager {
    private final List<Module> modules = new ArrayList<>();

    public ModuleManager() {
        modules.add(new KillAuraModule());
        modules.add(new AimAssistModule());
        modules.add(new AutoBlockModule());
        modules.add(new ESPModule());
        modules.add(new ScaffoldModule());
    }

    public List<Module> getModules() {
        return modules;
    }

    public Module getModule(Class<? extends Module> clazz) {
        for (Module m : modules) {
            if (m.getClass().equals(clazz)) return m;
        }
        return null;
    }

    public void onKey(int key) {
        if (key == 0) return;
        for (Module m : modules) {
            if (m.getKey() == key) {
                m.toggle();
            }
        }
    }

    public void onTick() {
        for (Module m : modules) {
            if (m.isEnabled()) {
                m.onTick();
            }
        }
    }

    public void onRender3D(float partialTicks) {
        for (Module m : modules) {
            if (m.isEnabled()) {
                m.onRender3D(partialTicks);
            }
        }
    }
}
