package com.example.forgeclient;

import com.example.forgeclient.module.ModuleManager;
import com.example.forgeclient.proxy.CommonProxy;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.common.Mod.EventHandler;
import net.minecraftforge.fml.common.Mod.Instance;
import net.minecraftforge.fml.common.SidedProxy;
import net.minecraftforge.fml.common.event.FMLInitializationEvent;
import net.minecraftforge.fml.common.event.FMLPostInitializationEvent;
import net.minecraftforge.fml.common.event.FMLPreInitializationEvent;

@Mod(modid = ForgeClientMod.MODID, name = ForgeClientMod.NAME, version = ForgeClientMod.VERSION, clientSideOnly = true)
public class ForgeClientMod {
    public static final String MODID = "forgeclient";
    public static final String NAME = "Forge Client Mod";
    public static final String VERSION = "1.0.0";

    @Instance(MODID)
    public static ForgeClientMod instance;

    @SidedProxy(
        clientSide = "com.example.forgeclient.proxy.ClientProxy",
        serverSide = "com.example.forgeclient.proxy.CommonProxy"
    )
    public static CommonProxy proxy;

    public static ModuleManager moduleManager;

    @EventHandler
    public void preInit(FMLPreInitializationEvent event) {
        proxy.preInit(event);
    }

    @EventHandler
    public void init(FMLInitializationEvent event) {
        moduleManager = new ModuleManager();
        proxy.init(event);
    }

    @EventHandler
    public void postInit(FMLPostInitializationEvent event) {
        proxy.postInit(event);
    }
}
