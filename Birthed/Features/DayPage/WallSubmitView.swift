import SwiftUI

/// A pasted link becomes a story in the pool. docs/the-wall.md section 5.
///
/// The person supplies one thing, the address. The server reads the page and
/// takes the headline and the outlet from it, and what comes back is shown
/// as the server extracted it. The headline is drawn as text, not a field:
/// it is the source's own wording and there is nothing here to edit it with.
struct WallSubmitView: View {
    let date: CalendarDate
    let palette: StagePalette

    @Environment(WallService.self) private var wall
    @Environment(\.dismiss) private var dismiss

    @State private var text = ""
    @State private var working = false
    @State private var refusal: String?
    @State private var preview: WallSubmitPreview?

    private var wallDate: WallDate? {
        wall.day?.wallDate ?? WallClock.openWall(for: date, now: wall.now)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let preview {
                        extracted(preview)
                    } else {
                        form
                    }
                }
                .padding(20)
            }
            .background(Theme.canvas)
            .navigationTitle(preview == nil ? "Add a story" : "Filed for this date")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(preview == nil ? "Cancel" : "Done") { dismiss() }
                }
            }
        }
    }

    // MARK: The link

    private var form: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Paste a link to a news story about \(date.displayName()).")
                .font(.subheadline)
            Text("The headline and the outlet come from the page itself. You cannot write them, and neither can anybody else. Ten a day.")
                .font(.caption)
                .foregroundStyle(.secondary)
            TextField("https://", text: $text)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.go)
                .onSubmit { Task { await submit() } }
            Button {
                Task { await submit() }
            } label: {
                HStack {
                    if working { ProgressView().controlSize(.small) }
                    Text(working ? "Reading the page" : "Submit")
                        .font(.subheadline.weight(.semibold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.accent)
            // White on bright honey is 1.8 to 1.
            .foregroundStyle(Theme.onAccent)
            .disabled(working || address == nil || wallDate == nil)
            if wallDate == nil {
                Text("That date is not open. A hive takes stories the day before, the day itself and the day after.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if let refusal {
                Text(refusal)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var address: URL? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed), let scheme = url.scheme?.lowercased(),
              scheme == "http" || scheme == "https", url.host != nil
        else { return nil }
        return url
    }

    private func submit() async {
        guard !working, let address, let wallDate else { return }
        working = true
        refusal = nil
        defer { working = false }
        do {
            preview = try await wall.submit(url: address, wallDate: wallDate)
            await wall.load(date: date)
        } catch {
            refusal = error.localizedDescription
        }
    }

    // MARK: What the server extracted

    private func extracted(_ preview: WallSubmitPreview) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(preview.line)
                .font(.subheadline)
            Text("HEADLINE, FROM THE SOURCE")
                .font(.caption.weight(.heavy))
                .kerning(2.0)
                .foregroundStyle(Theme.accent)
                .padding(.top, 6)
            // Text, not a field. There is no binding to edit it through.
            Text(preview.story.headline)
                .font(.system(.title3, design: .serif, weight: .heavy))
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            HStack(spacing: 6) {
                Image(systemName: "lock")
                Text(WallSubmitPreview.headlineNote)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            Text("Outlet: \(preview.story.outlet)")
                .font(.footnote)
            HStack(spacing: 8) {
                WallChip(tier: preview.story.tier)
                Text(preview.story.tier.meaning)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text(preview.story.standing)
                .font(.footnote)
                .foregroundStyle(.secondary)
            if let source = preview.story.sources.first {
                Text("QUOTATION, FROM THE PAGE")
                    .font(.caption.weight(.heavy))
                    .kerning(2.0)
                    .foregroundStyle(Theme.accent)
                    .padding(.top, 6)
                Text(source.quotation)
                    .font(.system(.body, design: .serif))
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                Text(source.verificationLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
