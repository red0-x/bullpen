import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, errorText } from "@/src/api";
import { useContractorActions } from "@/src/contractorActions";
import { usesNativeTabs } from "@/src/navigation";
import { toast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { AmenityIcon } from "@/src/components/AmenityIcon";
import { ContractorRow } from "@/src/components/bench/ContractorRow";
import { AddContractorSheet } from "@/src/components/bench/AddContractorSheet";
import { ImportPanel } from "@/src/components/bench/ImportPanel";
import { WatchPanel } from "@/src/components/bench/WatchPanel";
import { Badge, Btn, Card, Chip, ChipRow, EmptyState, H, Skeleton, T } from "@/src/ui";

const TABS = [["bench", "Ranked bench"], ["import", "Import contacts"], ["watch", "Bench watch"]] as const;

export default function Bench() {
  const params = useLocalSearchParams<{ tab?: string; add?: string; trade?: string; city?: string; focus?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles();
  const [tab, setTab] = useState<string>(params.tab || "bench");
  const [data, setData] = useState<any>(null);
  const [adding, setAdding] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api("/bench").then(setData).catch((e) => toast.error(errorText(e))), []);
  const actions = useContractorActions(load);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (params.tab) setTab(params.tab);
    if (params.focus) setTab("bench");
    if (params.add) {
      setTab("bench");
      setAdding({ trades: params.trade ? [params.trade] : [], service_area: params.city ? [params.city] : [] });
      router.setParams({ add: undefined, trade: undefined, city: undefined });
    }
  }, [params.tab, params.add, params.trade, params.city, params.focus, router]);

  return (
    <View style={s.root}>
      <ScreenHeader eyebrow="Contractors" title="Bench" sub="Ranked backups for every property and amenity." />
      <View style={s.tabs}>
        <ChipRow testID="bench-tabs">
          {TABS.map(([k, l]) => <Chip key={k} label={l} on={tab === k} onPress={() => setTab(k)} testID={`bench-tab-${k}`} />)}
        </ChipRow>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + 24, gap: 16 }} keyboardShouldPersistTaps="handled" testID="bench-scroll"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {!data ? <Skeleton height={240} testID="bench-loading" /> : (
          <>
            {tab === "bench" && (
              <>
                <Btn label="+ Add contractor" variant="secondary" onPress={() => setAdding({})} testID="bench-add-contractor-button" />
                {data.properties.length === 0 ? (
                  <EmptyState testID="bench-empty-state" title="No properties yet" body="Load the demo on the Rentals tab, or import contacts to start your bench." />
                ) : (
                  <View style={{ gap: 24 }} testID="slot-bench">
                    {data.properties.map((p: any) => (
                      <View key={p.id} style={{ gap: 12 }}>
                        <View>
                          <H size={26}>{p.name}</H>
                          <T size={14} muted>{p.city}</T>
                        </View>
                        {p.amenities.map((a: any) => (
                          <Card key={a.id} style={[{ gap: 10 }, params.focus === a.id && { borderColor: colors.brand }]} testID={`slot-${a.id}`}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <View style={s.icon}><AmenityIcon type={a.type} /></View>
                              <View style={{ flex: 1 }}>
                                <H size={18}>{a.label}</H>
                                <T size={12} muted>{a.trade}</T>
                              </View>
                              {a.active_count === 0 && <Badge kind="warn" label="No contractors" />}
                              {a.active_count === 1 && <Badge kind="warn" label="Only 1 backup" />}
                              {a.active_count >= 2 && <Badge kind="ready" label="Ready" />}
                            </View>
                            {a.bench.length === 0 && <T size={14} muted>Nobody covers this yet.</T>}
                            {a.bench.map((c: any) => <ContractorRow key={c.id} c={c} position={c.rank} actions={actions} />)}
                            {a.active_count < 2 && (
                              <Btn variant="link" label={`+ Add a ${a.trade.toLowerCase()} contractor`} onPress={() => setAdding({ trades: [a.trade], service_area: [p.city] })} testID={`slot-add-${a.id}`} />
                            )}
                          </Card>
                        ))}
                      </View>
                    ))}
                    {data.unmatched.length > 0 && (
                      <View style={{ gap: 8 }} testID="unmatched-section">
                        <H size={22}>Not matched to a slot</H>
                        <T size={14} muted>Their trade or service area doesn&apos;t match any property yet.</T>
                        {data.unmatched.map((c: any) => <ContractorRow key={c.id} c={c} actions={actions} />)}
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
            {tab === "import" && <ImportPanel trades={data.trades} onSaved={load} onManual={() => setAdding({})} />}
            {tab === "watch" && <WatchPanel onChanged={load} />}
          </>
        )}
      </ScrollView>
      {data && <AddContractorSheet open={!!adding} preset={adding} trades={data.trades} cities={data.cities} onClose={() => setAdding(null)} onSaved={load} />}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  tabs: { height: 56, justifyContent: "center", paddingHorizontal: 16, backgroundColor: c.surface, borderBottomWidth: 1.5, borderBottomColor: c.border },
  icon: { width: 36, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
}));
