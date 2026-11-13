import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc,  } from 'firebase/firestore';

import { db } from '../services/firebase.config';

import { Component, CUSTOM_ELEMENTS_SCHEMA, NgZone, inject, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';



@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ]
})

export class HomePage implements OnInit {
  
  private ngZone = inject(NgZone);

  segmentoActivo: string = 'registrar';

  nino = {
    nombre: '',
    edad: null as number | string | null,
    papa: '',
    telefono: '',
    observaciones: ''
  };

  listaNinos: any[] = [];
  totalNinos: number = 0;
  editandoId: string | null = null;

  servidor = {
    nombre: '',
    grupo: ''
  };

  listaServidores: any[] = [];
  editandoServidorId: string | null = null;

  filtroNinos: string = '';
  filtroServidores: string = '';
  
  // Por defecto arranca con la fecha de hoy
  fechaSeleccionada: string = new Date().toISOString().split('T')[0]; 

  constructor() {
    this.cargarDatosTiempoReal();
    this.cargarServidoresTiempoReal();
  }

  ngOnInit(): void {
    this.cargarDatosTiempoReal();
  }

  segmentChanged(event: any): void {
    this.segmentoActivo = event.detail.value;
    if (this.segmentoActivo === 'lista') {
      this.cargarDatosTiempoReal();
    } else if (this.segmentoActivo === 'servidores') {
      this.cargarServidoresTiempoReal();
    }
  }

  // ==================== CRUD NIÑOS ====================
  
  get totalHoy(): number {
    const hoy = new Date().toDateString();
    return this.listaNinos.filter(item => {
      if (!item.fecha) return false;
      const fechaItem = item.fecha.toDate ? item.fecha.toDate() : new Date(item.fecha);
      return fechaItem.toDateString() === hoy;
    }).length;
  }

  cargarParaEditar(item: any): void {
    this.nino = {
      nombre: item.nombre,
      edad: item.edad,
      papa: item.papa,
      telefono: item.telefono,
      observaciones: item.observaciones || ''
    };
    this.editandoId = item.id;
    this.segmentoActivo = 'registrar';
  }

  async registrarNino(): Promise<void> {
    const nombreLimpio = this.nino.nombre ? this.nino.nombre.trim() : '';
    const papaLimpio = this.nino.papa ? this.nino.papa.trim() : '';
    const telefonoLimpio = this.nino.telefono ? String(this.nino.telefono).trim() : '';
    
    // Conversión y validación segura de la edad
    const edadNum = Number(this.nino.edad);
    const esEdadValida = this.nino.edad !== null && this.nino.edad !== '' && !isNaN(edadNum) && edadNum > 0;

    // Validación general robusta
    if (!nombreLimpio || !papaLimpio || !telefonoLimpio || !esEdadValida) {
      alert('Faltan datos obligatorios. Por favor llena todos los campos marcados con *');
      return;
    }

    try {
      if (this.editandoId) {
        const docRef = doc(db, 'ninos', this.editandoId);
        await updateDoc(docRef, {
          nombre: nombreLimpio,
          edad: edadNum,
          papa: papaLimpio,
          telefono: telefonoLimpio,
          observaciones: this.nino.observaciones ? this.nino.observaciones.trim() : ''
        });
        alert('Registro actualizado correctamente.');
      } else {
        await addDoc(collection(db, 'ninos'), {
          nombre: nombreLimpio || '',
          edad: edadNum || 0,
          papa: papaLimpio || '',
          telefono: telefonoLimpio || '',
          observaciones: this.nino.observaciones ? this.nino.observaciones.trim() : '',
          activo: true, 
          fecha: new Date()
        });
        alert('Registro guardado correctamente.');
      }

      // LIMPIAR LOS CAMPOS, REINICIAR EL ID Y CAMBIAR A LA VISTA DE LISTA
      this.nino = { nombre: '', edad: null, papa: '', telefono: '', observaciones: '' };
      this.editandoId = null;
      this.segmentoActivo = 'lista';

    } catch (error) {
      console.error('Error al guardar: ', error);
      alert('Hubo un error al procesar la operación en Firebase.');
    }
  }

  async toggleActivo(item: any): Promise<void> {
    const nuevoEstado = !item.activo;
    const estadoAnterior = item.activo;

    this.ngZone.run(() => {
      this.listaNinos = this.listaNinos.map(n => {
        if (n.id === item.id) {
          return { ...n, activo: nuevoEstado };
        }
        return n;
      });
    });

    try {
      const docRef = doc(db, 'ninos', item.id);
      await updateDoc(docRef, { activo: nuevoEstado });
    } catch (error) {
      console.error('Error al cambiar el estado en Firebase:', error);
      this.ngZone.run(() => {
        this.listaNinos = this.listaNinos.map(n => {
          if (n.id === item.id) {
            return { ...n, activo: estadoAnterior };
          }
          return n;
        });
      });
      alert('No se pudo actualizar el estado en la base de datos.');
    }
  }

  get totalActivos(): number {
    return this.listaNinos.filter(item => item.activo === true).length;
  }

  cargarDatosTiempoReal(): void {
    onSnapshot(collection(db, 'ninos'), (snapshot) => {
      this.ngZone.run(() => {
        const temporales: any[] = [];
        snapshot.forEach((docSnap) => {
          temporales.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        this.listaNinos = temporales;
        this.totalNinos = this.listaNinos.length;
      });
    });
  }

  trackById(index: number, item: any): string {
    return item.id;
  }

  async eliminar(id: string): Promise<void> {
    if (confirm('¿Estás seguro de eliminar este registro?')) {
      try {
        this.ngZone.run(() => {
          this.listaNinos = this.listaNinos.filter(item => item.id !== id);
          this.totalNinos = this.listaNinos.length;
        });
        await deleteDoc(doc(db, 'ninos', id));
      } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Hubo un error al eliminar el registro.');
        this.cargarDatosTiempoReal();
      }
    }
  }

  // ==================== CRUD SERVIDORES ====================

  cargarServidoresTiempoReal(): void {
    onSnapshot(collection(db, 'servidores'), (snapshot) => {
      this.ngZone.run(() => {
        const temporales: any[] = [];
        snapshot.forEach((docSnap) => {
          temporales.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        this.listaServidores = temporales;
      });
    });
  }

  async guardarServidor(): Promise<void> {
    if (!this.servidor.nombre || !this.servidor.grupo) {
      alert('Por favor completa todos los campos obligatorios del servidor.');
      return;
    }

    try {
      if (this.editandoServidorId) {
        const docRef = doc(db, 'servidores', this.editandoServidorId);
        await updateDoc(docRef, {
          nombre: this.servidor.nombre,
          grupo: this.servidor.grupo
        });
        alert('Servidor actualizado correctamente.');
      } else {
        await addDoc(collection(db, 'servidores'), {
          nombre: this.servidor.nombre,
          grupo: this.servidor.grupo,
          fecha: new Date()
        });
        alert('Servidor guardado correctamente.');
      }

      this.servidor = { nombre: '', grupo: '' };
      this.editandoServidorId = null;
    } catch (error) {
      console.error('Error al guardar servidor:', error);
      alert('Hubo un error al procesar el servidor en Firebase.');
    }
  }

  cargarServidorParaEditar(item: any): void {
    this.servidor = {
      nombre: item.nombre,
      grupo: item.grupo
    };
    this.editandoServidorId = item.id;
  }

  async eliminarServidor(id: string): Promise<void> {
    if (confirm('¿Estás seguro de eliminar este servidor?')) {
      try {
        this.ngZone.run(() => {
          this.listaServidores = this.listaServidores.filter(item => item.id !== id);
        });
        await deleteDoc(doc(db, 'servidores', id));
      } catch (error) {
        console.error('Error al eliminar servidor:', error);
        alert('Hubo un error al eliminar el servidor.');
        this.cargarServidoresTiempoReal();
      }
    }
  }

  // ==================== FILTROS (FECHA Y BUSCADOR) ====================

  seleccionarHoy(): void {
    this.fechaSeleccionada = new Date().toISOString().split('T')[0];
  }

  get listaNinosFiltrada(): any[] {
    if (!this.fechaSeleccionada) {
      return [];
    }

    const partesFecha = this.fechaSeleccionada.split('T')[0].split('-');
    if (partesFecha.length !== 3) return [];

    const anioFiltro = parseInt(partesFecha[0], 10);
    const mesFiltro = parseInt(partesFecha[1], 10);
    const diaFiltro = parseInt(partesFecha[2], 10);

    let resultado = this.listaNinos.filter(item => {
      if (!item.fecha) return false;

      const fechaItem = item.fecha.toDate ? item.fecha.toDate() : new Date(item.fecha);
      if (isNaN(fechaItem.getTime())) return false;

      return (
        fechaItem.getFullYear() === anioFiltro &&
        (fechaItem.getMonth() + 1) === mesFiltro &&
        fechaItem.getDate() === diaFiltro
      );
    });

    if (this.filtroNinos.trim()) {
      const texto = this.filtroNinos.toLowerCase();
      resultado = resultado.filter(item => 
        item.nombre.toLowerCase().includes(texto) ||
        item.papa.toLowerCase().includes(texto)
      );
    }

    return resultado;
  }

  get listaServidoresFiltrada(): any[] {
    if (!this.filtroServidores.trim()) {
      return this.listaServidores;
    }
    return this.listaServidores.filter(item => 
      item.nombre.toLowerCase().includes(this.filtroServidores.toLowerCase()) ||
      item.grupo.toLowerCase().includes(this.filtroServidores.toLowerCase())
    );
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return 'Fecha no disponible';
    if (typeof fecha.toDate === 'function') {
      return fecha.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? 'Fecha inválida' : d.toLocaleDateString('es-ES');
  }

  filtrarPorFecha(): void {
    // Se ejecuta de manera reactiva al cambiar la fecha en el input
  }
}