import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { EVIDENCIAS, VERIFICACOES, type Evidencia } from '../../src/evidencias';
import { SCREEN_MARGIN, space, useTheme } from '../../src/theme';
import { Card, Screen, SectionTitle, Txt } from '../../src/ui';

const RATIO = 1206 / 2622; // proporção dos prints (largura/altura)

export default function Evidencias() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<Evidencia | null>(null);
  const thumbW = Math.min(240, width - SCREEN_MARGIN * 2 - space.lg * 2);

  return (
    <Screen>
      <View style={{ paddingTop: space.sm }}>
        <Txt variant="h1">Evidências</Txt>
        <Txt color="textSecondary">O protótipo funcionando, tela por tela. Toque numa imagem para ampliar.</Txt>
      </View>

      <Card style={{ gap: space.sm }}>
        <Txt variant="h3">Verificações</Txt>
        {VERIFICACOES.map((v) => (
          <View key={v} style={{ flexDirection: 'row', gap: space.sm }}>
            <Check size={18} strokeWidth={1.5} color={c.brandText} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Txt color="textSecondary">{v}</Txt>
            </View>
          </View>
        ))}
      </Card>

      {EVIDENCIAS.map((g) => (
        <View key={g.title} style={{ gap: space.md }}>
          <SectionTitle>{g.title}</SectionTitle>
          {g.items.map((e) => (
            <Card key={e.title} style={{ gap: space.md }}>
              <Pressable onPress={() => setOpen(e)} accessibilityRole="imagebutton" accessibilityLabel={`Ampliar: ${e.title}`} style={{ alignItems: 'center' }}>
                <Image
                  source={e.source}
                  resizeMode="contain"
                  style={{ width: thumbW, height: thumbW / RATIO, borderRadius: 12, borderWidth: 1, borderColor: c.border }}
                />
              </Pressable>
              <View style={{ gap: 2 }}>
                <Txt variant="h3">{e.title}</Txt>
                <Txt color="textSecondary">{e.caption}</Txt>
              </View>
            </Card>
          ))}
        </View>
      ))}

      <Modal visible={!!open} animationType="fade" onRequestClose={() => setOpen(null)} transparent>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(5,21,14,0.96)' }}>
          <Pressable onPress={() => setOpen(null)} accessibilityRole="button" accessibilityLabel="Fechar" style={{ alignSelf: 'flex-end', padding: space.lg }}>
            <X size={28} strokeWidth={1.5} color="#fff" />
          </Pressable>
          <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: space.xxl }}>
            {open ? <Image source={open.source} resizeMode="contain" style={{ width: width - 32, height: (width - 32) / RATIO }} /> : null}
            {open ? (
              <View style={{ padding: SCREEN_MARGIN }}>
                <Txt variant="h3" color="#fff">{open.title}</Txt>
                <Txt color="#DFF5E9" style={{ marginTop: 4 }}>{open.caption}</Txt>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}
