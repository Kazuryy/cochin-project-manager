import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { 
  FiTrendingUp, 
  FiCheckCircle, 
  FiClock, 
  FiHardDrive 
} from 'react-icons/fi';
import backupService from '../../../services/backupService';

// Constantes
const DAYS_IN_WEEK = 7;
const PERCENTAGE_MULTIPLIER = 100;

// Hook personnalisé pour les calculs de statistiques
const useBackupStats = (backups) => {
  return useMemo(() => {
    const totalBackups = backups.length;
    const completedBackups = backups.filter(b => b.status === 'completed');
    const failedBackups = backups.filter(b => b.status === 'failed');
    const runningBackups = backups.filter(b => b.status === 'running');
    
    const successRate = totalBackups > 0 
      ? (completedBackups.length / totalBackups * PERCENTAGE_MULTIPLIER).toFixed(1) 
      : 0;
    
    const totalSize = completedBackups.reduce((sum, backup) => sum + (backup.file_size || 0), 0);
    
    const avgDuration = completedBackups.length > 0 
      ? completedBackups.reduce((sum, backup) => sum + (backup.duration_seconds || 0), 0) / completedBackups.length
      : 0;
    
    const typeStats = {
      full: backups.filter(b => b.backup_type === 'full').length,
      metadata: backups.filter(b => b.backup_type === 'metadata').length,
      data: backups.filter(b => b.backup_type === 'data').length,
    };

    const now = new Date();
    const last7Days = backups.filter(b => {
      try {
        const backupDate = new Date(b.created_at);
        const daysDiff = (now - backupDate) / (1000 * 60 * 60 * 24);
        return daysDiff <= DAYS_IN_WEEK;
      } catch (error) {
        console.error('Erreur lors du calcul de la date:', error);
        return false;
      }
    });

    const previous7Days = backups.filter(b => {
      try {
        const backupDate = new Date(b.created_at);
        const daysDiff = (now - backupDate) / (1000 * 60 * 60 * 24);
        return daysDiff > DAYS_IN_WEEK && daysDiff <= DAYS_IN_WEEK * 2;
      } catch (error) {
        console.error('Erreur lors du calcul de la date:', error);
        return false;
      }
    });
    
    const trend = last7Days.length - previous7Days.length;
    const trendPercentage = previous7Days.length > 0 
      ? ((trend / previous7Days.length) * PERCENTAGE_MULTIPLIER).toFixed(1) 
      : 0;

    return {
      totalBackups,
      completedBackups,
      failedBackups,
      runningBackups,
      successRate,
      totalSize,
      avgDuration,
      typeStats,
      trend,
      trendPercentage
    };
  }, [backups]);
};

const BackupStatsWidget = ({ backups = [] }) => {
  const {
    totalBackups,
    completedBackups,
    failedBackups,
    runningBackups,
    successRate,
    totalSize,
    avgDuration,
    typeStats,
    trend,
    trendPercentage
  } = useBackupStats(backups);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Taux de réussite */}
      <div className="stat bg-base-100 rounded-lg shadow-sm">
        <div className="stat-figure text-success">
          <FiCheckCircle className="text-2xl" />
        </div>
        <div className="stat-title">Taux de réussite</div>
        <div className="stat-value text-success">{successRate}%</div>
        <div className="stat-desc">
          {completedBackups.length}/{totalBackups} réussies
        </div>
      </div>

      {/* Espace total */}
      <div className="stat bg-base-100 rounded-lg shadow-sm">
        <div className="stat-figure text-info">
          <FiHardDrive className="text-2xl" />
        </div>
        <div className="stat-title">Espace total</div>
        <div className="stat-value text-sm text-info">
          {backupService.formatFileSize(totalSize)}
        </div>
        <div className="stat-desc">
          {completedBackups.length} fichiers
        </div>
      </div>

      {/* Durée moyenne */}
      <div className="stat bg-base-100 rounded-lg shadow-sm">
        <div className="stat-figure text-warning">
          <FiClock className="text-2xl" />
        </div>
        <div className="stat-title">Durée moyenne</div>
        <div className="stat-value text-sm text-warning">
          {backupService.formatDuration(avgDuration)}
        </div>
        <div className="stat-desc">
          {failedBackups.length} échecs
        </div>
      </div>

      {/* Tendance */}
      <div className="stat bg-base-100 rounded-lg shadow-sm">
        <div className="stat-figure">
          {trend >= 0 ? (
            <FiTrendingUp className="text-2xl text-success" />
          ) : (
            <FiTrendingUp className="text-2xl text-error rotate-180" />
          )}
        </div>
        <div className="stat-title">Tendance 7j</div>
        <div className={`stat-value text-sm ${trend >= 0 ? 'text-success' : 'text-error'}`}>
          {trend >= 0 ? '+' : ''}{trend}
        </div>
        <div className="stat-desc">
          {trendPercentage >= 0 ? '+' : ''}{trendPercentage}% vs précédent
        </div>
      </div>

      {/* Types de sauvegardes */}
      <div className="stat bg-base-100 rounded-lg shadow-sm col-span-full">
        <div className="stat-title mb-3">Répartition par type</div>
        <div className="flex flex-wrap gap-3">
          <div className="badge badge-primary badge-lg">
            Complètes: {typeStats.full}
          </div>
          <div className="badge badge-secondary badge-lg">
            Métadonnées: {typeStats.metadata}
          </div>
          <div className="badge badge-accent badge-lg">
            Données: {typeStats.data}
          </div>
          {runningBackups.length > 0 && (
            <div className="badge badge-info badge-lg">
              En cours: {runningBackups.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

BackupStatsWidget.propTypes = {
  backups: PropTypes.arrayOf(
    PropTypes.shape({
      status: PropTypes.string.isRequired,
      backup_type: PropTypes.string.isRequired,
      file_size: PropTypes.number,
      duration_seconds: PropTypes.number,
      created_at: PropTypes.string.isRequired
    })
  )
};

export default BackupStatsWidget; 