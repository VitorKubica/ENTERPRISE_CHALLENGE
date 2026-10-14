import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { QrCode } from 'lucide-react-native';
import { palette, radius, space, useTheme } from './theme';
import { Button, Txt } from './ui';

/** Cantos do visor, para deixar claro onde apontar o QR code. */
function Corners() {
  const base = { position: 'absolute' as const, width: 28, height: 28, borderColor: palette.green300 };
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 24, bottom: 24, left: 48, right: 48 }}>
      <View style={[base, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 }]} />
      <View style={[base, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 }]} />
      <View style={[base, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 }]} />
      <View style={[base, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 }]} />
    </View>
  );
}

/** Leitor de QR code do carregador. Sem câmera (ex.: simulador), mostra um aviso. */
export function Scanner({ onCode, onError, paused }: { onCode: (code: string) => void; onError?: (message: string) => void; paused?: boolean }) {
  const { c } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    CameraView.isAvailableAsync().then(setHasCamera).catch(() => setHasCamera(false));
  }, []);
  useEffect(() => {
    if (!paused) lock.current = false;
  }, [paused]);

  const frame = { height: 210, borderRadius: radius.card, overflow: 'hidden' as const, backgroundColor: '#05150E', alignItems: 'center' as const, justifyContent: 'center' as const };

  let body: React.ReactNode;
  if (hasCamera === false) {
    body = (
      <View style={{ alignItems: 'center', gap: space.sm, padding: space.lg }}>
        <QrCode size={40} strokeWidth={1.5} color={palette.green300} />
        <Txt color={c.onHeroMuted} style={{ textAlign: 'center' }}>
          A câmera não está disponível neste aparelho.
        </Txt>
      </View>
    );
  } else if (!permission) {
    body = null;
  } else if (!permission.granted) {
    body = (
      <View style={{ alignItems: 'center', gap: space.md, padding: space.lg }}>
        <QrCode size={40} strokeWidth={1.5} color={palette.green300} />
        <Txt color={c.onHeroMuted} style={{ textAlign: 'center' }}>
          {permission.canAskAgain ? 'Precisamos da câmera para ler o QR code do carregador.' : 'A câmera está bloqueada. Libere nos ajustes do aparelho.'}
        </Txt>
        {permission.canAskAgain ? <Button label="Permitir câmera" onPress={requestPermission} variant="onHero" /> : null}
      </View>
    );
  } else {
    body = (
      <>
        <CameraView
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          facing="back"
          onMountError={() => onError?.('Não conseguimos abrir a câmera. Tente de novo.')}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={
            paused
              ? undefined
              : ({ data }) => {
                  if (lock.current) return;
                  lock.current = true;
                  onCode(data);
                }
          }
        />
        <Corners />
      </>
    );
  }

  return <View style={frame}>{body}</View>;
}
