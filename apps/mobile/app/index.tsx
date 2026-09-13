import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMobileWallet } from '@wallet-ui/react-native-kit';
import { PermissionCard } from '../src/components/PermissionCard';
import { QrScanner } from '../src/components/QrScanner';
import { demoUsage, makeDemoRequest } from '../src/lib/demo';
import { buildMobileAuthorizedOpen, returnApprovalToBridge } from '../src/lib/paymentChannel';
import { isLiveMppRequest, parseRequestFromUrl, type PermissionRequest } from '../src/lib/request';

type ActivityItem = { id: string; at: string; label: string; detail: string; tone: 'ok' | 'blocked' | 'info' };
const HISTORY_KEY = 'boundkey.activity.v1';

function short(value: string) {
  return value.length > 17 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value;
}

export default function HomeScreen() {
  const wallet = useMobileWallet();
  const incomingUrl = Linking.useURL();
  const [request, setRequest] = useState<PermissionRequest>(() => makeDemoRequest());
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [spent, setSpent] = useState(0);
  const [calls, setCalls] = useState(0);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const live = isLiveMppRequest(request);
  const maxSpend = request.asset.maxSpend;
  const remaining = useMemo(() => Math.max(0, maxSpend - spent), [maxSpend, spent]);
  const progress = Math.min(1, spent / maxSpend);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(raw => {
      if (raw) setActivity(JSON.parse(raw));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!incomingUrl?.startsWith('boundkey://authorize')) return;
    loadAuthorization(incomingUrl);
  }, [incomingUrl]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith('boundkey://authorize')) loadAuthorization(url);
    });
    return () => subscription.remove();
  }, []);

  function addActivity(item: Omit<ActivityItem, 'id' | 'at'>) {
    const next = [{ ...item, id: `${Date.now()}-${Math.random()}`, at: new Date().toISOString() }, ...activity].slice(0, 12);
    setActivity(next);
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => undefined);
  }

  function loadAuthorization(url: string) {
    try {
      const parsed = parseRequestFromUrl(url);
      setRequest(parsed);
      resetSession();
      setScanMode(false);
      addActivity({ label: 'Request received', detail: `${parsed.agent.name} → ${parsed.merchant.name}`, tone: 'info' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (error) {
      setScanMode(false);
      Alert.alert('Invalid authorization request', error instanceof Error ? error.message : String(error));
    }
  }

  function resetSession() {
    setApproved(false);
    setSpent(0);
    setCalls(0);
    setBlockedReason(null);
    setChannelId(null);
  }

  async function approve() {
    if (!wallet.account) {
      await wallet.connect();
      return;
    }

    setApproving(true);
    setBlockedReason(null);
    try {
      if (live) {
        const {
          context: { slot: minContextSlot },
        } = await wallet.client.rpc.getLatestBlockhash().send();
        const payerSigner = wallet.getTransactionSigner(wallet.account.address, minContextSlot);
        const open = await buildMobileAuthorizedOpen(request, payerSigner);
        await returnApprovalToBridge(request, open);
        setChannelId(open.channelId);
        addActivity({ label: 'Capability authorized', detail: `${request.asset.maxSpend} ${request.asset.symbol} · ${short(open.channelId)}`, tone: 'ok' });
      } else {
        setChannelId('demo-offline-channel');
        addActivity({ label: 'Demo capability started', detail: `${request.asset.maxSpend} ${request.asset.symbol} hard cap`, tone: 'ok' });
      }
      setApproved(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addActivity({ label: 'Authorization failed', detail: message, tone: 'blocked' });
      Alert.alert('Could not authorize', message);
    } finally {
      setApproving(false);
    }
  }

  function simulateCall() {
    if (!approved || live) return;
    const next = demoUsage[calls % demoUsage.length];
    if (spent + next.amount > maxSpend) {
      setBlockedReason('cap-exceeded');
      return;
    }
    const nextSpent = Number((spent + next.amount).toFixed(6));
    setSpent(nextSpent);
    setCalls(value => value + 1);
    addActivity({ label: next.label, detail: `$${next.amount.toFixed(3)} · $${(maxSpend - nextSpent).toFixed(3)} left`, tone: 'ok' });
    Haptics.selectionAsync().catch(() => undefined);
  }

  function simulateAttack(kind: 'cap' | 'payee') {
    if (!approved || live) return;
    const reason = kind === 'cap' ? 'cap-exceeded' : 'wrong-payee';
    setBlockedReason(reason);
    addActivity({
      label: 'Payment blocked',
      detail: kind === 'cap' ? '$5.00 exceeds the $0.50 capability' : 'Destination does not match the bound payee',
      tone: 'blocked',
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }

  function endCapability() {
    addActivity({ label: 'Capability ended', detail: channelId ? short(channelId) : request.id, tone: 'info' });
    resetSession();
  }

  if (scanMode) return <QrScanner onScanned={loadAuthorization} onClose={() => setScanMode(false)} />;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.nav}>
        <View style={styles.logoRow}><View style={styles.logoMark}><Text style={styles.logoGlyph}>B</Text></View><Text style={styles.brand}>BOUNDKEY</Text></View>
        <Pressable onPress={() => setScanMode(true)} style={styles.scanButton}><Text style={styles.scanText}>▣ Scan QR</Text></Pressable>
      </View>

      <Text style={styles.eyebrow}>FINANCIAL PERMISSIONS FOR AGENTS</Text>
      <Text style={styles.title}>Give the agent a key.{`\n`}Not your wallet.</Text>
      <Text style={styles.subtitle}>Your phone keeps custody. The agent gets a disposable Ed25519 session key bound to one service and one spend ceiling.</Text>

      <View style={styles.walletBar}>
        <View style={styles.walletIdentity}>
          <View style={[styles.walletDot, wallet.account ? styles.online : styles.offline]} />
          <View>
            <Text style={styles.muted}>Payer wallet stays on this phone</Text>
            <Text style={styles.walletText}>{wallet.account ? short(wallet.account.address.toString()) : 'Not connected'}</Text>
          </View>
        </View>
        <Pressable onPress={wallet.account ? wallet.disconnect : wallet.connect} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>{wallet.account ? 'Disconnect' : 'Connect'}</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}><Text style={styles.section}>Pending permission</Text><Text style={styles.protocol}>MPP · Solana</Text></View>
      <PermissionCard request={request} live={live} />

      {!approved ? (
        <>
          <Pressable disabled={approving} onPress={approve} style={[styles.primary, approving && styles.disabled]}>
            <Text style={styles.primaryText}>
              {approving ? 'Preparing channel…' : !wallet.account ? 'Connect wallet to review' : live ? `Authorize up to $${maxSpend.toFixed(2)}` : 'Run safe offline demo'}
            </Text>
          </Pressable>
          <Text style={styles.approvalHint}>{live ? 'Your wallet signs the channel open. The delegated session key stays on the agent machine.' : 'Demo mode never sends a transaction. Scan a live MPP request to use Mobile Wallet Adapter.'}</Text>
        </>
      ) : (
        <View style={styles.activeCard}>
          <View style={styles.activeHeader}>
            <View><Text style={styles.status}>● CAPABILITY ACTIVE</Text><Text style={styles.activeTitle}>{request.agent.name} → {request.merchant.name}</Text></View>
            <Text style={styles.bigMoney}>${spent.toFixed(3)}</Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${progress * 100}%` }]} /></View>
          <View style={styles.stats}><Text style={styles.muted}>{live ? 'streaming session' : `${calls} signed vouchers`}</Text><Text style={styles.muted}>${remaining.toFixed(3)} remaining</Text></View>
          {channelId && <Text style={styles.channel}>Channel · {short(channelId)}</Text>}
          {blockedReason && (
            <View style={styles.blocked}>
              <Text style={styles.blockedTitle}>BLOCKED BY CAPABILITY</Text>
              <Text style={styles.blockedText}>{blockedReason === 'cap-exceeded' ? 'The requested cumulative spend is above the channel deposit.' : 'The destination is not the payee bound into this capability.'}</Text>
            </View>
          )}
          {!live && (
            <>
              <Pressable onPress={simulateCall} style={styles.secondary}><Text style={styles.secondaryText}>Generate next paid voucher</Text></Pressable>
              <View style={styles.actions}>
                <Pressable onPress={() => simulateAttack('cap')} style={styles.danger}><Text style={styles.dangerText}>Try $5 attack</Text></Pressable>
                <Pressable onPress={() => simulateAttack('payee')} style={styles.danger}><Text style={styles.dangerText}>Change payee</Text></Pressable>
              </View>
            </>
          )}
          <Pressable onPress={endCapability} style={styles.end}><Text style={styles.endText}>End capability</Text></Pressable>
        </View>
      )}

      <View style={styles.proof}>
        <Text style={styles.proofKicker}>THE SECURITY BOUNDARY</Text>
        <Text style={styles.proofTitle}>Even a compromised agent does not hold your payer key.</Text>
        <View style={styles.proofGrid}>
          <View style={styles.proofItem}><Text style={styles.proofIcon}>01</Text><Text style={styles.proofLine}>Payer wallet signs only on mobile via MWA</Text></View>
          <View style={styles.proofItem}><Text style={styles.proofIcon}>02</Text><Text style={styles.proofLine}>Agent key signs cumulative MPP vouchers</Text></View>
          <View style={styles.proofItem}><Text style={styles.proofIcon}>03</Text><Text style={styles.proofLine}>Payment Channel enforces deposit + bound payee</Text></View>
        </View>
      </View>

      <View style={styles.activityBlock}>
        <View style={styles.sectionHeader}><Text style={styles.section}>Recent activity</Text><Text style={styles.activityCount}>{activity.length}</Text></View>
        {activity.length === 0 ? <Text style={styles.empty}>Approvals and blocked attempts will show up here.</Text> : activity.slice(0, 5).map(item => (
          <View key={item.id} style={styles.activityRow}>
            <View style={[styles.activityDot, item.tone === 'ok' ? styles.dotOk : item.tone === 'blocked' ? styles.dotBlocked : styles.dotInfo]} />
            <View style={styles.activityCopy}><Text style={styles.activityLabel}>{item.label}</Text><Text style={styles.activityDetail}>{item.detail}</Text></View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>Built for autonomous software that needs money — without handing it a wallet.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: '#09090B', paddingTop: 58, paddingHorizontal: 20, paddingBottom: 52 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logoMark: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#8AF0A0', alignItems: 'center', justifyContent: 'center' },
  logoGlyph: { color: '#07150A', fontWeight: '900', fontSize: 17 },
  brand: { color: '#F4F4F5', fontWeight: '900', letterSpacing: 1.8, fontSize: 12 },
  scanButton: { backgroundColor: '#18181B', borderWidth: 1, borderColor: '#29292E', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12 },
  scanText: { color: '#D4D4D8', fontWeight: '800', fontSize: 12 },
  eyebrow: { color: '#8AF0A0', fontSize: 11, letterSpacing: 1.4, fontWeight: '900', marginBottom: 12 },
  title: { color: '#FAFAFA', fontSize: 39, lineHeight: 42, fontWeight: '900', letterSpacing: -1.7 },
  subtitle: { color: '#A1A1AA', fontSize: 16, lineHeight: 23, marginTop: 14, marginBottom: 27 },
  walletBar: { backgroundColor: '#121214', borderRadius: 18, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, borderWidth: 1, borderColor: '#202024' },
  walletIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  walletDot: { width: 8, height: 8, borderRadius: 8 }, online: { backgroundColor: '#8AF0A0' }, offline: { backgroundColor: '#52525B' },
  muted: { color: '#85858E', fontSize: 11 },
  walletText: { color: '#EFEFF1', fontWeight: '800', marginTop: 4, fontSize: 13 },
  smallButton: { backgroundColor: '#232327', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 13 },
  smallButtonText: { color: '#F4F4F5', fontWeight: '800', fontSize: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  section: { color: '#D4D4D8', fontWeight: '800', fontSize: 13 },
  protocol: { color: '#6B6B73', fontWeight: '700', fontSize: 11 },
  primary: { backgroundColor: '#8AF0A0', padding: 17, borderRadius: 17, alignItems: 'center', marginTop: 16 },
  disabled: { opacity: .55 },
  primaryText: { color: '#07150A', fontWeight: '900', fontSize: 16 },
  approvalHint: { color: '#66666F', textAlign: 'center', fontSize: 11, lineHeight: 16, marginTop: 10, paddingHorizontal: 12 },
  activeCard: { marginTop: 16, backgroundColor: '#101812', borderColor: '#24402A', borderWidth: 1, borderRadius: 22, padding: 18 },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  status: { color: '#8AF0A0', fontWeight: '900', fontSize: 11, letterSpacing: .8 },
  activeTitle: { color: '#F5F5F6', fontWeight: '800', marginTop: 7, maxWidth: 220 },
  bigMoney: { color: '#F5F5F6', fontSize: 26, fontWeight: '900' },
  track: { height: 8, backgroundColor: '#28332A', borderRadius: 99, overflow: 'hidden', marginTop: 20 },
  fill: { height: '100%', backgroundColor: '#8AF0A0' },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  channel: { color: '#777780', fontFamily: 'monospace', fontSize: 11, marginTop: 11 },
  blocked: { backgroundColor: '#2A1214', borderColor: '#5C2228', borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 16 },
  blockedTitle: { color: '#FF8B95', fontWeight: '900', fontSize: 11, letterSpacing: .7 },
  blockedText: { color: '#D9A4A9', marginTop: 5, lineHeight: 18, fontSize: 13 },
  secondary: { backgroundColor: '#203024', borderRadius: 13, padding: 13, alignItems: 'center', marginTop: 18 },
  secondaryText: { color: '#C4F9CE', fontWeight: '800', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  danger: { flex: 1, backgroundColor: '#2A1719', borderRadius: 13, padding: 12, alignItems: 'center' },
  dangerText: { color: '#FFA3AB', fontWeight: '800', fontSize: 11 },
  end: { alignItems: 'center', paddingTop: 17 },
  endText: { color: '#9A9AA2', fontWeight: '700' },
  proof: { marginTop: 30, padding: 18, backgroundColor: '#111113', borderRadius: 22, borderWidth: 1, borderColor: '#202024' },
  proofKicker: { color: '#74747D', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  proofTitle: { color: '#F2F2F4', fontWeight: '900', fontSize: 18, lineHeight: 23, marginTop: 8, marginBottom: 17 },
  proofGrid: { gap: 13 },
  proofItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  proofIcon: { color: '#8AF0A0', fontSize: 11, fontWeight: '900', paddingTop: 2 },
  proofLine: { color: '#A1A1AA', lineHeight: 18, fontSize: 13, flex: 1 },
  activityBlock: { marginTop: 30 },
  activityCount: { color: '#6D6D75', fontWeight: '800', fontSize: 11 },
  activityRow: { flexDirection: 'row', gap: 11, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#252529' },
  activityDot: { width: 8, height: 8, borderRadius: 8, marginTop: 6 }, dotOk: { backgroundColor: '#8AF0A0' }, dotBlocked: { backgroundColor: '#FF7884' }, dotInfo: { backgroundColor: '#7F8CFF' },
  activityCopy: { flex: 1 }, activityLabel: { color: '#E4E4E7', fontWeight: '800', fontSize: 13 }, activityDetail: { color: '#74747D', fontSize: 12, lineHeight: 17, marginTop: 3 },
  empty: { color: '#66666F', fontSize: 13, paddingVertical: 14 },
  footer: { color: '#55555D', textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 34, paddingHorizontal: 26 },
});
