import React from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Banknote,
  Check,
  ChevronRight,
  Plus,
  Smartphone,
  Wallet,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useCheckoutStore } from '@/src/features/cart/store/checkout-store';
import type { PaymentMethod } from '@/src/features/cart/types';

type SelectablePaymentMethod = {
  id: 'cod' | 'vnpay';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  method: PaymentMethod;
};

const PAYMENT_METHODS: SelectablePaymentMethod[] = [
  {
    id: 'cod',
    title: 'Cash on Delivery',
    subtitle: 'Pay when you receive your order',
    icon: <Banknote size={22} color="#0d631b" />,
    method: {
      id: 'cod',
      brand: 'Cash on Delivery',
      last4: 'Pay on delivery',
      type: 'cash',
    },
  },
  {
    id: 'vnpay',
    title: 'VNPay',
    subtitle: 'Pay via VNPay gateway',
    icon: <Wallet size={22} color="#40493d" />,
    method: {
      id: 'vnpay',
      brand: 'VNPay',
      last4: 'VNPay gateway',
      type: 'vnpay',
    },
  },
];

function getInitialSelection(method: PaymentMethod | null): 'cod' | 'vnpay' {
  if (method?.id === 'vnpay') return 'vnpay';
  return 'cod';
}

function PaymentOptionCard({
  item,
  selected,
  onPress,
}: {
  item: SelectablePaymentMethod;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={item.title}
      className="overflow-hidden rounded-3xl"
      style={{
        backgroundColor: selected ? '#ffffff' : '#f3f3f3',
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? '#00490e' : 'transparent',
        boxShadow: selected
          ? '0 4px 16px rgba(26, 28, 28, 0.04)'
          : '0 0 0 rgba(0, 0, 0, 0)',
      }}
    >
      {selected ? (
        <View className="absolute inset-0 bg-primary-fixed/10" />
      ) : null}
      <View className="flex-row items-center justify-between p-5">
        <View className="flex-1 flex-row items-center gap-4 pr-3">
          <View className="h-10 w-14 items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-high">
            {item.icon}
          </View>
          <View className="flex-1">
            <Text className="font-jakarta-sans text-base font-semibold text-on-surface">
              {item.title}
            </Text>
            <Text className="mt-0.5 font-inter text-xs text-on-surface-variant">
              {item.subtitle}
            </Text>
          </View>
        </View>
        {selected ? (
          <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
            <Check size={15} color="#ffffff" strokeWidth={3} />
          </View>
        ) : (
          <View className="h-6 w-6 rounded-full border-2 border-outline" />
        )}
      </View>
    </TouchableOpacity>
  );
}

function OtherMethodRow({
  label,
  icon,
}: {
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={() =>
        Alert.alert(
          'Coming Soon',
          `${label} will be available in a future update.`,
        )
      }
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center justify-between p-4 active:bg-surface-container-highest"
    >
      <View className="flex-row items-center gap-4">
        <View
          className="h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest"
          style={{ boxShadow: '0 1px 4px rgba(26, 28, 28, 0.06)' }}
        >
          {icon}
        </View>
        <Text className="font-jakarta-sans text-base font-medium text-on-surface">
          {label}
        </Text>
      </View>
      <ChevronRight size={20} color="#707a6c" />
    </TouchableOpacity>
  );
}

export function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { selectedPaymentMethod, setSelectedPaymentMethod } =
    useCheckoutStore();
  const [selectedId, setSelectedId] = React.useState<'cod' | 'vnpay'>(
    getInitialSelection(selectedPaymentMethod),
  );

  const selectedMethod = PAYMENT_METHODS.find((item) => item.id === selectedId);

  const handleConfirm = () => {
    if (!selectedMethod) return;
    setSelectedPaymentMethod(selectedMethod.method);
    Toast.show({
      type: 'success',
      text1: 'Payment method saved',
      text2: selectedMethod.title,
    });
    router.back();
  };

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      <StatusBar barStyle="dark-content" />

      <View className="h-16 flex-row items-center border-b border-outline-variant/15 bg-surface/90 px-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-container-low"
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={24} color="#0d631b" />
        </TouchableOpacity>
        <Text className="flex-1 pr-10 text-center font-jakarta-sans text-lg font-bold text-primary-container">
          UITFood
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 24,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 128,
          gap: 32,
        }}
      >
        <View className="gap-2">
          <Text className="font-jakarta-sans text-3xl font-bold tracking-tight text-on-surface">
            Payment
          </Text>
          <Text className="font-inter text-sm text-on-surface-variant">
            Choose how you would like to pay for your fresh groceries.
          </Text>
        </View>

        <View className="gap-4">
          <Text className="font-jakarta-sans text-lg font-semibold text-on-surface">
            Saved Cards
          </Text>
          <View className="gap-3">
            {PAYMENT_METHODS.map((item) => (
              <PaymentOptionCard
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onPress={() => setSelectedId(item.id)}
              />
            ))}
          </View>

          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Coming Soon',
                'Card payments will be available soon.',
              )
            }
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Add new card"
            className="mt-1 flex-row items-center justify-center gap-2 rounded-3xl border border-dashed border-outline py-4 active:bg-primary-fixed/20"
          >
            <Plus size={20} color="#00490e" />
            <Text className="font-jakarta-sans text-base font-semibold text-primary">
              Add New Card
            </Text>
          </TouchableOpacity>
        </View>

        <View className="gap-4">
          <Text className="font-jakarta-sans text-lg font-semibold text-on-surface">
            Other Methods
          </Text>
          <View className="overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-low">
            <OtherMethodRow
              label="Apple Pay"
              icon={<Smartphone size={21} color="#1a1c1c" />}
            />
            <View className="mx-4 h-px bg-outline-variant/15" />
            <OtherMethodRow
              label="Google Pay"
              icon={<Smartphone size={21} color="#1a1c1c" />}
            />
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-outline-variant/15 bg-surface/95 px-4 pt-4"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <TouchableOpacity
          onPress={handleConfirm}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Save payment method"
          className="overflow-hidden rounded-full"
          style={{ boxShadow: '0 8px 24px rgba(13, 99, 27, 0.20)' }}
        >
          <LinearGradient
            colors={['#00490e', '#0d631b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 56,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Text className="font-jakarta-sans text-lg font-bold text-on-primary">
              Save
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
