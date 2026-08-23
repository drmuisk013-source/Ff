package com.example.forgeclient.module;

import net.minecraft.client.Minecraft;

public abstract class Module {
    protected final Minecraft mc = Minecraft.getMinecraft();
    private final String name;
    private final String description;
    private final Category category;
    private int key;
    private boolean enabled;

    public Module(String name, String description, Category category, int key) {
        this.name = name;
        this.description = description;
        this.category = category;
        this.key = key;
        this.enabled = false;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public Category getCategory() {
        return category;
    }

    public int getKey() {
        return key;
    }

    public void setKey(int key) {
        this.key = key;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
        if (enabled) {
            onEnable();
        } else {
            onDisable();
        }
    }

    public void toggle() {
        setEnabled(!enabled);
    }

    public void onEnable() {}
    public void onDisable() {}
    public void onTick() {}
    public void onRender3D(float partialTicks) {}
}
