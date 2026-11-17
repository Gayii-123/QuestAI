import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InspectionProgressViewModel } from '../../../core/models/inspection-view.models';

@Component({
  selector: 'app-inspection-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inspection-progress.component.html',
  styleUrls: ['./inspection-progress.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectionProgressComponent {
  @Input({ required: true }) progress!: InspectionProgressViewModel;
}

