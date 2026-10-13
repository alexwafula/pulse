@description('Notification budget only. It does not stop resource usage.')
param budgetName string = 'pulse-credit-alerts'

@minValue(1)
param amount int = 20

@description('First day of the budget start month, YYYY-MM-DD.')
param startDate string

@description('Budget expiry, YYYY-MM-DD. Monthly budgets reset each month.')
param endDate string

@secure()
@description('Email for cost notifications. Never hardcode a teammate address.')
param contactEmail string

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: amount
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: startDate
      endDate: endDate
    }
    notifications: {
      Actual25: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 25
        thresholdType: 'Actual'
        contactEmails: [contactEmail]
      }
      Actual50: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 50
        thresholdType: 'Actual'
        contactEmails: [contactEmail]
      }
      Actual100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: [contactEmail]
      }
    }
  }
}

output budgetID string = budget.id
