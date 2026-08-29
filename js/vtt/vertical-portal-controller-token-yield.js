import { VerticalPortalController as BaseVerticalPortalController } from './vertical-portal-controller.js';

export class VerticalPortalController extends BaseVerticalPortalController {
    handleMouseDown(event) {
        // The vertical editor listens in capture phase. Without this guard, a portal under a
        // ficha can stopImmediatePropagation() before Engine receives the drag. Fichas must
        // remain the primary hit target for the DM, matching the topology editor behavior.
        if (event?.button === 0 && this.engine?.tokenAtEvent?.(event)) return;
        return super.handleMouseDown(event);
    }
}
