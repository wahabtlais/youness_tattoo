interface ConsultationTriggerProps {
  onOpen: () => void;
}

/**
 * Visual entry point for the eventual consultation / voice-assistant flow
 * (brief step 10). Purely a trigger - see ConsultationPanel for the
 * component boundary the real implementation will fill later.
 */
export function ConsultationTrigger({ onOpen }: ConsultationTriggerProps) {
  return (
    <button type="button" className="consultationTrigger unstyled" onClick={onOpen}>
      Start a consultation
    </button>
  );
}
