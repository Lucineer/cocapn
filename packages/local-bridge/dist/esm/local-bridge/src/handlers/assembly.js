/**
 * Assembly status handler
 *
 * Returns the self-assembly result for the current bridge instance.
 */
import { SelfAssembler as AssemblySystem } from "../assembly/index.js";
export async function handleAssemblyStatus(params, context) {
    const { bridge } = context;
    if (!bridge) {
        return {
            error: "Bridge not available",
            success: false,
        };
    }
    const assembly = bridge.getAssembly();
    if (!assembly) {
        return {
            error: "Assembly not yet run",
            success: false,
        };
    }
    return {
        success: assembly.success,
        profile: assembly.profile,
        template: assembly.template,
        modules: assembly.modules,
        skills: assembly.skills,
        config: assembly.config,
        duration: assembly.duration,
        formatted: AssemblySystem.formatStatus(assembly),
    };
}
//# sourceMappingURL=assembly.js.map