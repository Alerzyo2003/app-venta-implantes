import { onlineManager } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '@/theme/theme';

import { Button } from '../Button';
import { PriceTag } from '../PriceTag';
import { QuantityStepper } from '../QuantityStepper';
import { EmptyState, ErrorState, LoadingState } from '../States';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

const wrap = (ui: React.ReactElement) => render(<AppThemeProvider>{ui}</AppThemeProvider>);

describe('Button', () => {
  it('ejecuta la acción y expone su rol accesible', async () => {
    const onPress = jest.fn();
    await wrap(<Button title="Agregar al carrito" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar al carrito' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('deshabilitado no ejecuta la acción', async () => {
    const onPress = jest.fn();
    await wrap(<Button title="Pagar" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pagar' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('PriceTag', () => {
  it('muestra el precio con IVA y la referencia neta', async () => {
    await wrap(<PriceTag gross={107088} net={89990} visible />);
    expect(screen.getByText('$107.088')).toBeTruthy();
    expect(screen.getByText('IVA incluido · $89.990 + IVA')).toBeTruthy();
  });

  it('si el usuario no puede ver precios muestra el motivo, nunca un valor', async () => {
    await wrap(<PriceTag gross={107088} visible={false} hiddenReason="Inicia sesión para ver precios" />);
    expect(screen.getByText('Inicia sesión para ver precios')).toBeTruthy();
    expect(screen.queryByText('$107.088')).toBeNull();
  });
});

describe('QuantityStepper', () => {
  it('respeta el mínimo y el máximo', async () => {
    const onChange = jest.fn();
    const { rerender } = await wrap(<QuantityStepper value={1} onChange={onChange} max={2} />);
    await fireEvent.press(screen.getByLabelText('Disminuir cantidad'));
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Aumentar cantidad'));
    expect(onChange).toHaveBeenLastCalledWith(2);
    await rerender(
      <AppThemeProvider>
        <QuantityStepper value={2} onChange={onChange} max={2} />
      </AppThemeProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Aumentar cantidad'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('estados', () => {
  it('EmptyState muestra título, mensaje y acción', async () => {
    const onAction = jest.fn();
    await wrap(<EmptyState title="Tu carrito está vacío" message="Agrega productos" actionLabel="Buscar" onAction={onAction} />);
    expect(screen.getByText('Tu carrito está vacío')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Buscar' }));
    expect(onAction).toHaveBeenCalled();
  });

  it('ErrorState traduce errores de red y de negocio sin detalles técnicos', async () => {
    await wrap(<ErrorState error={new TypeError('Network request failed')} onRetry={() => {}} />);
    expect(screen.getByText('Sin conexión')).toBeTruthy();
    expect(screen.getByText('Revisa tu conexión a internet e intenta nuevamente.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('LoadingState informa la falta de conexión en vez de cargar indefinidamente', async () => {
    onlineManager.setOnline(false);
    try {
      await wrap(<LoadingState />);
      expect(screen.getByText('Sin conexión')).toBeTruthy();
      expect(screen.queryByText('Cargando…')).toBeNull();
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('ErrorState muestra el mensaje de negocio en español', async () => {
    await wrap(<ErrorState error={{ message: 'OUT_OF_STOCK', code: 'P0001' }} />);
    expect(screen.getByText('No hay stock suficiente para uno de los productos.')).toBeTruthy();
  });
});
