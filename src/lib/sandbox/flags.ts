import { storageEnabled } from "@/lib/storage";

/** True when "Download video with sound" can be offered: the switch (Config SANDBOX_MUX=on) is on and the platform and storage are set up. */
export const muxEnabled = () => process.env.SANDBOX_MUX === "on" && Boolean(process.env.SANDBOX_PROVIDER) && storageEnabled;
