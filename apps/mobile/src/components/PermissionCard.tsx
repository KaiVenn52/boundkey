import { View, Text, StyleSheet } from 'react-native';
import type { PermissionRequest } from '../lib/request';

function short(value: string) {
  return value.length > 22 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export function PermissionCard({ request, live }: { request: PermissionRequest; live: boolean }) {
  const expires = Math.max(0, Math.round((Date.parse(request.expiresAt) - Date.now()) / 60_000));
  return (
    <View style={styles.card}>
      <View style={styles.topline}>
        <View style={[styles.badge, live ? styles.liveBadge : styles.demoBadge]}>
          <Text style={[styles.badgeText, live ? styles.liveText : styles.demoText]}>{live ? 'LIVE MPP SESSION' : 'SAFE DEMO MODE'}</Text>
        </View>
        <Text style={styles.expiry}>{expires}m request TTL</Text>
      </View>
      <View style={styles.row}><Text style={styles.label}>Agent</Text><Text style={styles.value}>{request.agent.name}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Service</Text><Text style={styles.value}>{request.merchant.name}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Hard cap</Text><Text style={styles.amount}>${request.asset.maxSpend.toFixed(2)} {request.asset.symbol}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Session key</Text><Text style={styles.mono}>{short(request.agent.publicKey)}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Bound payee</Text><Text style={styles.mono}>{short(request.merchant.payee)}</Text></View>
      <View style={styles.divider} />
      <Text style={styles.purpose}>{request.purpose}</Text>
      <Text style={styles.rail}>MPP session · client-signed vouchers · Solana Payment Channels</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#151517', borderColor: '#29292E', borderWidth: 1, borderRadius: 22, padding: 18, gap: 14 },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  badge: { borderRadius: 99, paddingVertical: 5, paddingHorizontal: 8 },
  liveBadge: { backgroundColor: '#15381D' }, demoBadge: { backgroundColor: '#27272B' },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: .7 }, liveText: { color: '#8AF0A0' }, demoText: { color: '#B6B6BD' },
  expiry: { color: '#71717A', fontSize: 11 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, alignItems: 'center' },
  label: { color: '#8C8C93', fontSize: 14 },
  value: { color: '#F7F7F8', fontWeight: '700', fontSize: 15, textAlign: 'right', flexShrink: 1 },
  amount: { color: '#9BFFB0', fontWeight: '900', fontSize: 18 },
  mono: { color: '#C9C9CF', fontFamily: 'monospace', fontSize: 12, flexShrink: 1 },
  divider: { height: 1, backgroundColor: '#29292E' },
  purpose: { color: '#D0D0D5', lineHeight: 20, fontSize: 14 },
  rail: { color: '#6F6F77', fontSize: 11, lineHeight: 16 },
});
