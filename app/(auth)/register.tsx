import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';

export default function Screen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>PrÃ³ximamente...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.light.background },
  text: { fontSize: 18, color: Colors.light.text },
});
