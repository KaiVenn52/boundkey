import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export function QrScanner({ onScanned, onClose }: { onScanned: (value: string) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  if (!permission) return <View style={styles.page} />;
  if (!permission.granted) {
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Scan an agent request</Text>
        <Text style={styles.copy}>BoundKey uses the camera only to read the authorization QR shown by your agent.</Text>
        <Pressable style={styles.primary} onPress={requestPermission}><Text style={styles.primaryText}>Allow camera</Text></Pressable>
        <Pressable style={styles.link} onPress={onClose}><Text style={styles.linkText}>Cancel</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}><Text style={styles.title}>Scan agent QR</Text><Pressable onPress={onClose}><Text style={styles.close}>Close</Text></Pressable></View>
      <View style={styles.frame}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={locked ? undefined : ({ data }) => {
            setLocked(true);
            onScanned(data);
          }}
        />
        <View style={styles.reticle} pointerEvents="none" />
      </View>
      <Text style={styles.hint}>The QR contains the agent session key, payee, cap and MPP challenge. Review everything before signing.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#09090B', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { color: '#F7F7F8', fontSize: 28, fontWeight: '900' },
  copy: { color: '#A1A1AA', fontSize: 15, lineHeight: 22, marginTop: 14 },
  close: { color: '#8AF0A0', fontWeight: '800' },
  frame: { flex: 1, maxHeight: 560, borderRadius: 28, overflow: 'hidden', backgroundColor: '#18181B', position: 'relative' },
  reticle: { position: 'absolute', width: 240, height: 240, borderWidth: 2, borderColor: '#8AF0A0', borderRadius: 28, alignSelf: 'center', top: '28%' },
  hint: { color: '#71717A', fontSize: 13, lineHeight: 19, marginTop: 18 },
  primary: { backgroundColor: '#8AF0A0', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 24 },
  primaryText: { color: '#07150A', fontWeight: '900' },
  link: { alignItems: 'center', padding: 14 }, linkText: { color: '#A1A1AA', fontWeight: '700' },
});
