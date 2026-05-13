import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert,
  ScrollView, Dimensions, Switch,
  Animated, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Home, Navigation, Bell, Pause, Shield, Share2, Settings } from 'lucide-react-native';

const { height: SH } = Dimensions.get('window');

// ── palette ──────────────────────────────────────────────────
const BG    = '#0C0C0C';
const SHEET = '#1A1A1A';
const CARD  = '#242424';
const W     = '#FFFFFF';
const MUTED = '#A1A1AA';
const BDR   = '#2E2E2E';
const RED   = '#EF233C';
const GREEN = '#16A34A';
const MAPBG = '#E8EAED';

// ── sheet snap positions ──────────────────────────────────────
const TAB_BAR_H   = 68;                          // approx tab bar + safe area
const PEEK        = 145;                          // how much sheet shows collapsed
const EXPANDED_H  = Math.round(SH * 0.70);       // full expanded sheet height
const SNAP_CLOSED = EXPANDED_H - PEEK;           // translateY when collapsed
const SNAP_OPEN   = 0;                           // translateY when expanded
const DRAG_THRESHOLD = 50;                        // px needed to snap

export default function UbicacionScreen() {
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen]   = useState(false);
  const [arrivalOn, setArrivalOn] = useState(true);

  // Animated value for vertical position of the sheet
  const translateY = useRef(new Animated.Value(SNAP_CLOSED)).current;
  // Track whether currently expanded
  const openRef = useRef(false);

  const snapTo = (open: boolean) => {
    openRef.current = open;
    setIsOpen(open);
    Animated.spring(translateY, {
      toValue: open ? SNAP_OPEN : SNAP_CLOSED,
      useNativeDriver: true,
      bounciness: 4,
      speed: 14,
    }).start();
  };

  // PanResponder for drag gesture
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        const base  = openRef.current ? SNAP_OPEN : SNAP_CLOSED;
        const next  = Math.max(SNAP_OPEN, Math.min(SNAP_CLOSED, base + g.dy));
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        // If dragged up enough → open; down enough → close; else snap back
        if (g.dy < -DRAG_THRESHOLD) {
          snapTo(true);
        } else if (g.dy > DRAG_THRESHOLD) {
          snapTo(false);
        } else {
          // snap back to current state
          snapTo(openRef.current);
        }
      },
    })
  ).current;

  const go = (msg: string) => Alert.alert(msg, 'Función disponible pronto.');

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ══════ MAP — fills entire screen behind sheet ══════ */}
      <View style={s.map}>

        {/* header overlay */}
        <View style={s.hdr}>
          <Text style={s.hdrT}>Ubicación</Text>
          <Text style={s.hdrS}>Saber si tu pareja llegó bien</Text>
        </View>

        {/* grid */}
        <View style={[s.gH,{top:'14%'}]}/><View style={[s.gH,{top:'28%'}]}/>
        <View style={[s.gH,{top:'42%'}]}/><View style={[s.gH,{top:'56%'}]}/>
        <View style={[s.gH,{top:'70%'}]}/><View style={[s.gH,{top:'84%'}]}/>
        <View style={[s.gV,{left:'13%'}]}/><View style={[s.gV,{left:'26%'}]}/>
        <View style={[s.gV,{left:'39%'}]}/><View style={[s.gV,{left:'52%'}]}/>
        <View style={[s.gV,{left:'65%'}]}/><View style={[s.gV,{left:'78%'}]}/>

        {/* safe zone */}
        <View style={s.safeZone}/>
        {/* route */}
        <View style={s.route}/>

        {/* Tu marker */}
        <View style={[s.mk, {left:'18%', bottom:'28%'}]}>
          <View style={s.mkTu}/><Text style={s.mkLbl}>Tú</Text>
        </View>

        {/* Sofia marker */}
        <View style={[s.mk, {left:'43%', top:'32%'}]}>
          <View style={s.pulse}/>
          <MapPin size={26} color={RED}/>
          <Text style={[s.mkLbl,{color:RED,fontWeight:'800'}]}>Sofia</Text>
        </View>

        {/* Casa marker */}
        <View style={[s.mk, {right:'14%', bottom:'32%'}]}>
          <View style={s.mkHome}><Home size={14} color={W}/></View>
          <Text style={s.mkLbl}>Casa</Text>
        </View>

        {/* floating pills */}
        <View style={[s.pill, {top: 74, left: 16}]}>
          <View style={s.pillDot}/>
          <Text style={s.pillTxt}>Compartiendo ubicación</Text>
        </View>
        <View style={[s.pill, {top: 74, right: 16}]}>
          <Navigation size={11} color={RED}/>
          <Text style={[s.pillTxt,{color:RED,marginLeft:5}]}>12 min a casa</Text>
        </View>
      </View>

      {/* ══════ DRAGGABLE BOTTOM SHEET ══════ */}
      <Animated.View
        {...pan.panHandlers}
        style={[
          s.sheet,
          {
            height: EXPANDED_H,
            paddingBottom: insets.bottom + TAB_BAR_H,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* ── drag handle area — main gesture target ── */}
        <View style={s.handleArea}>
          <View style={s.handle}/>
          <Text style={s.handleHint}>
            {isOpen ? 'Desliza hacia abajo para cerrar' : 'Desliza hacia arriba para ver detalles'}
          </Text>
        </View>

        {/* ── partner summary — always visible ── */}
        <View style={s.partnerRow}>
          <View style={s.avatar}><Text style={s.avatarLetter}>S</Text></View>
          <View style={{flex:1, marginLeft:14}}>
            <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
              <Text style={s.pName}>Sofia</Text>
              <View style={s.activeDot}/>
            </View>
            <Text style={s.pStatus}>En camino a casa</Text>
            <Text style={s.pEta}>A 12 min de casa  •  Hace 5 min</Text>
          </View>
        </View>

        {/* ── expanded sections inside ScrollView ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollEnabled={isOpen}
          contentContainerStyle={{paddingBottom: 20}}
        >
          <View style={s.divider}/>

          {/* A. Llegada segura */}
          <Text style={s.secTitle}>Llegada segura</Text>
          <View style={s.safeCard}>
            <View style={{flex:1}}>
              <Text style={s.safeLabel}>Casa — Recibir aviso cuando llegue</Text>
              <Text style={[s.safeSub, {color: arrivalOn ? GREEN : MUTED}]}>
                {arrivalOn ? 'Notificación activada' : 'Notificación desactivada'}
              </Text>
            </View>
            <Switch
              value={arrivalOn}
              onValueChange={v => {
                setArrivalOn(v);
                Alert.alert('Aviso de llegada actualizado', v ? 'Activado' : 'Desactivado');
              }}
              trackColor={{false:'#3A3A3A', true: RED}}
              thumbColor={W}
            />
          </View>

          <View style={s.divider}/>

          {/* B. Avisos recientes */}
          <Text style={s.secTitle}>Avisos recientes</Text>
          {[
            {icon:<Bell size={14} color={RED}/>,              txt:'Sofia salió de la universidad', time:'Hoy, 7:10 PM'},
            {icon:<Navigation size={14} color={MUTED}/>,      txt:'Sofia está en camino',          time:'Hoy, 7:35 PM'},
            {icon:<Home size={14} color={GREEN}/>,            txt:'Sofia llegó a casa',             time:'Ayer, 8:42 PM'},
          ].map((a,i) => (
            <View key={i} style={s.alertRow}>
              <View style={s.alertIcon}>{a.icon}</View>
              <View style={{flex:1}}>
                <Text style={s.alertTxt}>{a.txt}</Text>
                <Text style={s.alertTime}>{a.time}</Text>
              </View>
            </View>
          ))}

          <View style={s.divider}/>

          {/* C. Controles */}
          <Text style={s.secTitle}>Controles</Text>
          <View style={s.ctrlGrid}>
            {[
              {icon:<Pause size={18} color={W}/>,    lbl:'Pausar ubicación'},
              {icon:<Shield size={18} color={W}/>,   lbl:'Editar lugares'},
              {icon:<Settings size={18} color={W}/>, lbl:'Permisos'},
              {icon:<Share2 size={18} color={RED}/>,  lbl:'Compartir'},
            ].map((c,i) => (
              <Pressable
                key={i}
                style={({pressed}) => [s.ctrlBtn, pressed && {opacity:0.7}]}
                onPress={() => go(c.lbl)}
              >
                <View style={s.ctrlIc}>{c.icon}</View>
                <Text style={s.ctrlLbl}>{c.lbl}</Text>
              </Pressable>
            ))}
          </View>

          <View style={s.divider}/>

          {/* D. Privacy */}
          <View style={s.privacyBox}>
            <Shield size={13} color={MUTED}/>
            <Text style={s.privacyTxt}>
              La ubicación solo se comparte si ambos aceptan. Puedes pausarla cuando quieras.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex:1, backgroundColor:BG },

  // MAP — fills entire screen (sheet floats over it)
  map: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MAPBG,
    overflow: 'hidden',
  },
  gH:   {position:'absolute', left:0, right:0, height:1, backgroundColor:'rgba(0,0,0,0.06)'},
  gV:   {position:'absolute', top:0, bottom:0, width:1, backgroundColor:'rgba(0,0,0,0.06)'},
  safeZone: {
    position:'absolute', right:'10%', bottom:'26%',
    width:90, height:90, borderRadius:45,
    borderWidth:2, borderColor:GREEN, borderStyle:'dashed',
    backgroundColor:'rgba(22,163,74,0.07)',
  },
  route: {
    position:'absolute', width:2, height:140,
    backgroundColor:RED, opacity:0.22,
    left:'52%', top:'26%', transform:[{rotate:'28deg'}],
  },
  mk:     {position:'absolute', alignItems:'center'},
  mkTu:   {width:14, height:14, borderRadius:7, backgroundColor:'#111', borderWidth:2.5, borderColor:W},
  mkHome: {width:28, height:28, borderRadius:14, backgroundColor:'#555', justifyContent:'center', alignItems:'center'},
  mkLbl:  {fontSize:9, fontWeight:'700', color:'#333', marginTop:3, letterSpacing:0},
  pulse:  {position:'absolute', top:-10, width:46, height:46, borderRadius:23, backgroundColor:RED, opacity:0.12},
  pill:   {position:'absolute', flexDirection:'row', alignItems:'center', backgroundColor:'rgba(0,0,0,0.72)', paddingHorizontal:12, paddingVertical:6, borderRadius:20},
  pillDot:{width:6, height:6, borderRadius:3, backgroundColor:GREEN, marginRight:6},
  pillTxt:{fontSize:11, fontWeight:'600', color:W, letterSpacing:0},

  // header overlay (on map)
  hdr:  {position:'absolute', top:0, left:0, right:0, paddingHorizontal:20, paddingTop:12, paddingBottom:10, backgroundColor:'rgba(0,0,0,0.35)'},
  hdrT: {fontSize:22, fontWeight:'800', color:W, letterSpacing:0},
  hdrS: {fontSize:12, color:'rgba(255,255,255,0.68)', marginTop:1, letterSpacing:0},

  // SHEET — absolutely positioned at bottom, slides up/down
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: SHEET,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {width:0, height:-4},
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 16,
  },

  // drag handle
  handleArea: {alignItems:'center', paddingTop:10, paddingBottom:6},
  handle:     {width:44, height:4, borderRadius:2, backgroundColor:'#3E3E3E', marginBottom:5},
  handleHint: {fontSize:11, color:MUTED, letterSpacing:0},

  // partner row
  partnerRow:   {flexDirection:'row', alignItems:'center', marginBottom:4},
  avatar:       {width:44, height:44, borderRadius:22, backgroundColor:RED, justifyContent:'center', alignItems:'center'},
  avatarLetter: {fontSize:19, fontWeight:'800', color:W},
  pName:        {fontSize:17, fontWeight:'800', color:W, letterSpacing:0},
  activeDot:    {width:8, height:8, borderRadius:4, backgroundColor:GREEN},
  pStatus:      {fontSize:13, color:MUTED, marginTop:2, letterSpacing:0},
  pEta:         {fontSize:12, color:MUTED, marginTop:1, letterSpacing:0},

  divider:  {height:1, backgroundColor:BDR, marginVertical:14},
  secTitle: {fontSize:14, fontWeight:'700', color:W, marginBottom:10, letterSpacing:0},

  safeCard:  {flexDirection:'row', alignItems:'center', backgroundColor:CARD, borderRadius:14, padding:14},
  safeLabel: {fontSize:13, fontWeight:'600', color:W, letterSpacing:0},
  safeSub:   {fontSize:11, marginTop:3, letterSpacing:0, fontWeight:'600'},

  alertRow:  {flexDirection:'row', alignItems:'flex-start', marginBottom:12},
  alertIcon: {width:30, height:30, borderRadius:15, backgroundColor:CARD, justifyContent:'center', alignItems:'center', marginRight:12},
  alertTxt:  {fontSize:13, fontWeight:'600', color:W, letterSpacing:0},
  alertTime: {fontSize:11, color:MUTED, marginTop:2, letterSpacing:0},

  ctrlGrid: {flexDirection:'row', flexWrap:'wrap', gap:10},
  ctrlBtn:  {flex:1, minWidth:'44%', backgroundColor:CARD, borderRadius:14, padding:14, alignItems:'center', gap:7},
  ctrlIc:   {width:38, height:38, borderRadius:19, backgroundColor:'#333', justifyContent:'center', alignItems:'center'},
  ctrlLbl:  {fontSize:11, fontWeight:'600', color:W, letterSpacing:0, textAlign:'center'},

  privacyBox: {flexDirection:'row', alignItems:'flex-start', backgroundColor:CARD, borderRadius:12, padding:12, gap:10},
  privacyTxt: {flex:1, fontSize:11, color:MUTED, lineHeight:16, letterSpacing:0},
});
